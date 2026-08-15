package com.shikshapilot.nativeapp.domain.model

data class LeaveRequest(
    val id: String,
    val studentName: String,
    val leaveType: String,
    val startDate: String,
    val endDate: String,
    val reason: String,
    val status: String
)
