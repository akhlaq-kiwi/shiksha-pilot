package com.shikshapilot.nativeapp.data.remote

import com.shikshapilot.nativeapp.domain.model.Resource
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map

inline fun <ResultType, RequestType> networkBoundResource(
    crossinline query: () -> Flow<ResultType>,
    crossinline fetch: suspend () -> RequestType,
    crossinline saveFetchResult: suspend (RequestType) -> Unit,
    crossinline shouldFetch: (ResultType) -> Boolean = { true }
): Flow<Resource<ResultType>> = flow {
    emit(Resource.Loading())

    val data = query().first()

    val flow = if (shouldFetch(data)) {
        emit(Resource.Loading(data))
        try {
            saveFetchResult(fetch())
            query().map { Resource.Success(it, isFromCache = false) }
        } catch (throwable: Throwable) {
            query().map { Resource.Error(throwable.message ?: "An unexpected error occurred", it) }
        }
    } else {
        query().map { Resource.Success(it, isFromCache = true) }
    }

    emitAll(flow)
}
