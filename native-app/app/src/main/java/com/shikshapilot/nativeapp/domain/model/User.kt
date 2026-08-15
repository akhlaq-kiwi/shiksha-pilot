package com.shikshapilot.nativeapp.domain.model

data class User(
    val id: String,
    val name: String,
    val role: String,
    val phone: String,
    val schoolName: String,
    val photoUrl: String? = null,
    val token: String
)
