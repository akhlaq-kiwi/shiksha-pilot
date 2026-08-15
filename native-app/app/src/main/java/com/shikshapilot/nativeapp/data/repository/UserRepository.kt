package com.shikshapilot.nativeapp.data.repository

import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class UserProfile(
    val name: String,
    val phone: String,
    val role: String,
    val schoolName: String,
    val email: String = "admin@shikshapilot.com",
    val avatarUrl: String? = null,
    val status: String = "Active",
    val memberSince: String = "August 2024"
)

object UserRepository {
    private val _currentUser = MutableStateFlow(
        UserProfile(
            name = "Camm School Admin",
            phone = "9900000001",
            role = "SCHOOL_ADMIN",
            schoolName = "CAMM SCHOOL"
        )
    )
    val currentUser: StateFlow<UserProfile> = _currentUser.asStateFlow()

    fun updateProfile(phone: String, role: String, schoolName: String) {
        val calculatedName = when (role.uppercase()) {
            "TEACHER" -> "Rajesh Sharma (Teacher)"
            "PARENT" -> "Sunita Verma (Parent)"
            "STUDENT" -> "Aarav Sharma (Student)"
            else -> "Camm School Admin"
        }
        val calculatedEmail = "${role.lowercase()}@shikshapilot.com"

        _currentUser.value = UserProfile(
            name = calculatedName,
            phone = phone,
            role = role,
            schoolName = schoolName,
            email = calculatedEmail
        )
    }

    suspend fun refreshProfileFromApi() {
        try {
            val response = RetrofitClient.apiService.getProfile()
            val profile = response.body()?.data
            if (response.isSuccessful && profile != null) {
                val current = _currentUser.value
                _currentUser.value = current.copy(
                    name = profile.name ?: current.name,
                    phone = profile.phone ?: current.phone,
                    role = profile.role ?: current.role,
                    schoolName = profile.school_name ?: current.schoolName,
                    email = profile.email ?: current.email,
                    avatarUrl = profile.photo_path ?: current.avatarUrl,
                    status = profile.status ?: current.status
                )
            }
        } catch (e: Exception) {
            // Keep local cached profile state intact on failure (Local-First Offline Fallback)
        }
    }
}
