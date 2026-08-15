package com.shikshapilot.nativeapp.features.schooladmin.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.StudentItemDto
import com.shikshapilot.nativeapp.data.remote.TransferStudentsRequestDto
import com.shikshapilot.nativeapp.ui.components.ThreeDotsLoader
import com.shikshapilot.nativeapp.ui.components.PullToRefreshWrapper
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.theme.CardBorder
import com.shikshapilot.nativeapp.ui.theme.DarkCanvas
import com.shikshapilot.nativeapp.ui.theme.FrostedCard
import com.shikshapilot.nativeapp.ui.theme.OnlineGreen
import com.shikshapilot.nativeapp.ui.theme.SunsetOrange
import com.shikshapilot.nativeapp.ui.theme.TextPrimary
import com.shikshapilot.nativeapp.ui.theme.TextSecondary
import kotlinx.coroutines.launch

@Composable
fun SchoolAdminStudentsScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    classNameFilter: String? = null,
    onBack: () -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onAvatarClick: () -> Unit = {},
    onEnrollNewStudent: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var searchQuery by remember { mutableStateOf("") }
    var allStudents by remember { mutableStateOf<List<StudentItemDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var refreshKey by remember { mutableStateOf(0) }

    var transferMode by remember { mutableStateOf(false) }
    var selectedIds by remember { mutableStateOf<Set<Int>>(emptySet()) }
    var showTransferDialog by remember { mutableStateOf(false) }
    var destSectionInput by remember { mutableStateOf("") }
    var transferError by remember { mutableStateOf<String?>(null) }
    var isTransferring by remember { mutableStateOf(false) }

    fun submitTransfer() {
        if (classNameFilter.isNullOrBlank()) return
        if (destSectionInput.isBlank()) {
            transferError = "Enter a destination section."
            return
        }
        isTransferring = true
        transferError = null
        scope.launch {
            try {
                val response = RetrofitClient.apiService.transferStudents(
                    TransferStudentsRequestDto(
                        class_name = classNameFilter,
                        destination_section = destSectionInput.trim(),
                        student_ids = selectedIds.toList()
                    )
                )
                if (response.isSuccessful) {
                    Toast.makeText(context, "${selectedIds.size} student(s) transferred", Toast.LENGTH_SHORT).show()
                    showTransferDialog = false
                    transferMode = false
                    selectedIds = emptySet()
                    destSectionInput = ""
                    refreshKey++
                } else {
                    transferError = "Failed to transfer (code ${response.code()})"
                }
            } catch (e: Exception) {
                transferError = e.message ?: "Network error while transferring"
            } finally {
                isTransferring = false
            }
        }
    }

    // Live QA Server API Students Request
    LaunchedEffect(searchQuery, refreshKey) {
        isLoading = true
        try {
            val response = RetrofitClient.apiService.getStudents(
                search = searchQuery.ifEmpty { null }
            )
            if (response.isSuccessful && response.body()?.data != null) {
                allStudents = response.body()!!.data
            }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            isLoading = false
        }
    }

    val studentsList = remember(allStudents, classNameFilter) {
        if (classNameFilter.isNullOrBlank()) {
            allStudents
        } else {
            allStudents.filter { it.class_name?.trim()?.equals(classNameFilter.trim(), ignoreCase = true) == true }
        }
    }

    Scaffold(
        containerColor = DarkCanvas
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(DarkCanvas)
        ) {
            PullToRefreshWrapper(isRefreshing = isLoading, onRefresh = { refreshKey++ }) {
            Column(modifier = Modifier.fillMaxSize()) {
                // Header Top Bar
                StickyTopBar(
                    schoolName = schoolName,
                    unreadNotificationCount = 2,
                    onNotificationClick = onNotificationClick,
                    onAvatarClick = onAvatarClick
                )

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp, vertical = 12.dp)
                ) {
                    // Back & Title Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = CircleShape)
                                .clickable { onBack() },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.ArrowBackIos,
                                contentDescription = "Back",
                                tint = TextPrimary,
                                modifier = Modifier.size(16.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = if (classNameFilter.isNullOrBlank()) "Student Directory & Enrollment" else classNameFilter,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "${studentsList.size} Enrolled Students",
                                fontSize = 11.5.sp,
                                color = SunsetOrange
                            )
                        }

                        if (!classNameFilter.isNullOrBlank()) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(if (transferMode) SunsetOrange else FrostedCard)
                                    .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(12.dp))
                                    .clickable {
                                        transferMode = !transferMode
                                        if (!transferMode) selectedIds = emptySet()
                                    }
                                    .padding(horizontal = 10.dp, vertical = 6.dp)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Default.SwapHoriz,
                                        contentDescription = "Transfer",
                                        tint = if (transferMode) Color.White else TextPrimary,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = "Transfer",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (transferMode) Color.White else TextPrimary
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                        }

                        // Enroll New Student Button
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(SunsetOrange)
                                .clickable { onEnrollNewStudent() }
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.PersonAdd,
                                    contentDescription = "Add",
                                    tint = Color.White,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = "Enroll",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Search Bar
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Search by Student Name, SR No., or Class...", color = TextSecondary, fontSize = 13.5.sp) },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search", tint = SunsetOrange) },
                        singleLine = true,
                        shape = RoundedCornerShape(16.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = FrostedCard,
                            unfocusedContainerColor = FrostedCard,
                            focusedBorderColor = SunsetOrange,
                            unfocusedBorderColor = CardBorder,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )

                    if (transferMode && selectedIds.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(10.dp))
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(SunsetOrange)
                                .clickable {
                                    destSectionInput = ""
                                    transferError = null
                                    showTransferDialog = true
                                }
                                .padding(vertical = 12.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "Transfer ${selectedIds.size} student(s)",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Dynamic Student List
                    if (isLoading) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            ThreeDotsLoader(
                                dotSize = 10.dp,
                                dotColor = SunsetOrange,
                                spaceBetween = 8.dp,
                                travelDistance = 8.dp
                            )
                        }
                    } else if (studentsList.isEmpty()) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = "No student records found", color = TextSecondary, fontSize = 14.sp)
                        }
                    } else {
                        LazyColumn(
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.fillMaxSize()
                        ) {
                            items(studentsList) { student ->
                                val className = if (student.section != null) "${student.class_name}-${student.section}" else (student.class_name ?: "Unassigned")
                                val srStr = if (student.sr_no != null) "SR-${student.sr_no}" else "SR N/A"
                                val rollStr = if (student.roll_no != null) "Roll ${student.roll_no}" else "Roll N/A"
                                val fatherStr = student.father_name ?: "Parent N/A"
                                val isSelected = selectedIds.contains(student.id)

                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(18.dp))
                                        .background(if (isSelected) SunsetOrange.copy(alpha = 0.12f) else FrostedCard)
                                        .border(width = 1.dp, color = if (isSelected) SunsetOrange else CardBorder, shape = RoundedCornerShape(18.dp))
                                        .let {
                                            if (transferMode) it.clickable {
                                                selectedIds = if (isSelected) selectedIds - student.id else selectedIds + student.id
                                            } else it
                                        }
                                        .padding(14.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        if (transferMode) {
                                            Icon(
                                                imageVector = if (isSelected) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                                                contentDescription = "Select",
                                                tint = if (isSelected) SunsetOrange else TextSecondary,
                                                modifier = Modifier.size(22.dp)
                                            )
                                            Spacer(modifier = Modifier.width(10.dp))
                                        }
                                        Box(
                                            modifier = Modifier
                                                .size(42.dp)
                                                .clip(CircleShape)
                                                .background(SunsetOrange.copy(alpha = 0.18f))
                                                .border(width = 1.dp, color = SunsetOrange.copy(alpha = 0.4f), shape = CircleShape),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                text = student.name.take(1).uppercase(),
                                                fontSize = 18.sp,
                                                fontWeight = FontWeight.Black,
                                                color = SunsetOrange
                                            )
                                        }

                                        Spacer(modifier = Modifier.width(12.dp))

                                        Column(modifier = Modifier.weight(1f)) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(
                                                    text = student.name,
                                                    fontSize = 15.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = TextPrimary
                                                )
                                                Text(
                                                    text = srStr,
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = TextSecondary
                                                )
                                            }

                                            Spacer(modifier = Modifier.height(2.dp))

                                            Text(
                                                text = "$className • $rollStr • Father: $fatherStr",
                                                fontSize = 12.sp,
                                                color = TextSecondary
                                            )

                                            Spacer(modifier = Modifier.height(4.dp))

                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Box(
                                                    modifier = Modifier
                                                        .clip(RoundedCornerShape(6.dp))
                                                        .background(OnlineGreen.copy(alpha = 0.2f))
                                                        .padding(horizontal = 6.dp, vertical = 2.dp)
                                                ) {
                                                    Text(
                                                        text = student.status ?: "ACTIVE",
                                                        fontSize = 10.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = OnlineGreen
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            }
        }
    }

    if (showTransferDialog) {
        Dialog(onDismissRequest = { if (!isTransferring) showTransferDialog = false }) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(DarkCanvas)
                    .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(20.dp))
                    .padding(20.dp)
            ) {
                Column {
                    Text(
                        text = "Transfer ${selectedIds.size} Student(s)",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Moving within $classNameFilter to a different section.",
                        fontSize = 12.sp,
                        color = TextSecondary
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(text = "Destination Section", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextSecondary)
                    Spacer(modifier = Modifier.height(6.dp))
                    OutlinedTextField(
                        value = destSectionInput,
                        onValueChange = { destSectionInput = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("e.g. B") },
                        singleLine = true,
                        shape = RoundedCornerShape(14.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = FrostedCard,
                            unfocusedContainerColor = FrostedCard,
                            focusedBorderColor = SunsetOrange,
                            unfocusedBorderColor = CardBorder,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )

                    if (transferError != null) {
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(text = transferError ?: "", fontSize = 11.5.sp, color = Color(0xFFEF4444))
                    }

                    Spacer(modifier = Modifier.height(18.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End
                    ) {
                        TextButton(onClick = { if (!isTransferring) showTransferDialog = false }) {
                            Text("Cancel", color = TextSecondary)
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Button(
                            onClick = { submitTransfer() },
                            enabled = !isTransferring,
                            colors = ButtonDefaults.buttonColors(containerColor = SunsetOrange)
                        ) {
                            if (isTransferring) {
                                ThreeDotsLoader(dotSize = 6.dp, dotColor = Color.White, spaceBetween = 4.dp, travelDistance = 4.dp)
                            } else {
                                Text("Transfer", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }

}
