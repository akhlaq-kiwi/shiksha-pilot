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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material.icons.filled.DirectionsBus
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import com.shikshapilot.nativeapp.data.remote.AssignTransportFeeRequestDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.StudentItemDto
import com.shikshapilot.nativeapp.data.remote.ToggleTransportFeeStatusRequestDto
import com.shikshapilot.nativeapp.data.remote.TransportFeeItemDto
import com.shikshapilot.nativeapp.data.remote.UpdateTransportFeeRequestDto
import com.shikshapilot.nativeapp.ui.components.PullToRefreshWrapper
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.components.ThreeDotsLoader
import com.shikshapilot.nativeapp.ui.theme.CardBorder
import com.shikshapilot.nativeapp.ui.theme.DarkCanvas
import com.shikshapilot.nativeapp.ui.theme.FrostedCard
import com.shikshapilot.nativeapp.ui.theme.OnlineGreen
import com.shikshapilot.nativeapp.ui.theme.SunsetOrange
import com.shikshapilot.nativeapp.ui.theme.TextPrimary
import com.shikshapilot.nativeapp.ui.theme.TextSecondary
import kotlinx.coroutines.launch

/**
 * Backend: GET/POST/PUT/DELETE api/school/transport-fees{,/{id}}, PUT .../{id}/status
 * (SchoolAdminController::getTransportFees/assignTransportFee/updateTransportFee/deleteTransportFee/
 * toggleTransportFeeStatus). Matches web FinanceManagementPage.jsx's transport-fee tab.
 */
@Composable
fun SchoolAdminTransportFeesScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onAvatarClick: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var feesList by remember { mutableStateOf<List<TransportFeeItemDto>>(emptyList()) }
    var studentsList by remember { mutableStateOf<List<StudentItemDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableStateOf(0) }

    var showFormDialog by remember { mutableStateOf(false) }
    var isEditing by remember { mutableStateOf(false) }
    var editId by remember { mutableStateOf(0) }
    var selectedStudent by remember { mutableStateOf<StudentItemDto?>(null) }
    var monthlyFeeInput by remember { mutableStateOf("") }
    var startDateInput by remember { mutableStateOf("") }
    var formError by remember { mutableStateOf<String?>(null) }
    var isSaving by remember { mutableStateOf(false) }
    var menuForId by remember { mutableStateOf<Int?>(null) }

    LaunchedEffect(refreshKey) {
        isLoading = true
        errorMessage = null
        try {
            val feesRes = RetrofitClient.apiService.getTransportFees()
            if (feesRes.isSuccessful && feesRes.body() != null) {
                feesList = feesRes.body()!!.data
            } else {
                errorMessage = "Unable to load transport fees (code ${feesRes.code()})"
            }
            val studentsRes = RetrofitClient.apiService.getStudents()
            if (studentsRes.isSuccessful && studentsRes.body()?.data != null) {
                studentsList = studentsRes.body()!!.data
            }
        } catch (e: Exception) {
            errorMessage = e.message ?: "Network error while loading transport fees"
        } finally {
            isLoading = false
        }
    }

    fun resetForm() {
        showFormDialog = false
        isEditing = false
        editId = 0
        selectedStudent = null
        monthlyFeeInput = ""
        startDateInput = ""
        formError = null
    }

    fun openEditDialog(item: TransportFeeItemDto) {
        isEditing = true
        editId = item.id
        selectedStudent = studentsList.find { it.id == item.student_id }
        monthlyFeeInput = item.monthly_fee.toString()
        startDateInput = item.start_date
        formError = null
        showFormDialog = true
    }

    fun saveTransportFee() {
        val fee = monthlyFeeInput.toDoubleOrNull()
        if (!isEditing && selectedStudent == null) {
            formError = "Please select a student."
            return
        }
        if (fee == null || fee < 0) {
            formError = "Enter a valid monthly fee."
            return
        }
        if (startDateInput.isBlank()) {
            formError = "Start date is required."
            return
        }
        isSaving = true
        formError = null
        scope.launch {
            try {
                val response = if (isEditing) {
                    RetrofitClient.apiService.updateTransportFee(
                        editId,
                        UpdateTransportFeeRequestDto(monthly_fee = fee, start_date = startDateInput)
                    )
                } else {
                    RetrofitClient.apiService.assignTransportFee(
                        AssignTransportFeeRequestDto(
                            student_id = selectedStudent!!.id,
                            monthly_fee = fee,
                            start_date = startDateInput
                        )
                    )
                }
                if (response.isSuccessful) {
                    Toast.makeText(context, if (isEditing) "Transport fee updated" else "Transport fee assigned", Toast.LENGTH_SHORT).show()
                    resetForm()
                    refreshKey++
                } else {
                    formError = "Failed to save (code ${response.code()})"
                }
            } catch (e: Exception) {
                formError = e.message ?: "Network error while saving"
            } finally {
                isSaving = false
            }
        }
    }

    fun toggleStatus(item: TransportFeeItemDto) {
        val newStatus = if (item.status == "Active") "Inactive" else "Active"
        scope.launch {
            try {
                val response = RetrofitClient.apiService.toggleTransportFeeStatus(item.id, ToggleTransportFeeStatusRequestDto(newStatus))
                if (response.isSuccessful) {
                    refreshKey++
                } else {
                    Toast.makeText(context, "Failed to update status (code ${response.code()})", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, e.message ?: "Network error", Toast.LENGTH_SHORT).show()
            }
        }
    }

    fun deleteTransportFee(item: TransportFeeItemDto) {
        scope.launch {
            try {
                val response = RetrofitClient.apiService.deleteTransportFee(item.id)
                if (response.isSuccessful) {
                    Toast.makeText(context, "Transport fee deleted", Toast.LENGTH_SHORT).show()
                    refreshKey++
                } else {
                    Toast.makeText(context, "Cannot delete — billing history may already exist.", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, e.message ?: "Network error", Toast.LENGTH_SHORT).show()
            }
        }
    }

    Scaffold(
        containerColor = DarkCanvas,
        floatingActionButton = {
            FloatingActionButton(
                onClick = { resetForm(); showFormDialog = true },
                containerColor = SunsetOrange
            ) {
                Text(text = "+", fontSize = 18.5.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(DarkCanvas)
        ) {
            PullToRefreshWrapper(isRefreshing = isLoading, onRefresh = { refreshKey++ }) {
            Column(modifier = Modifier.fillMaxSize()) {
                StickyTopBar(
                    schoolName = schoolName,
                    unreadNotificationCount = 2,
                    onNotificationClick = onNotificationClick,
                    onAvatarClick = onAvatarClick
                )

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 13.dp, vertical = 10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
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
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(10.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Transport Fees",
                                fontSize = 15.5.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "${feesList.size} students assigned",
                                fontSize = 10.sp,
                                color = SunsetOrange
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(11.dp))

                    when {
                        isLoading -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                ThreeDotsLoader(dotSize = 10.dp, dotColor = SunsetOrange, spaceBetween = 8.dp, travelDistance = 8.dp)
                            }
                        }
                        errorMessage != null -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = errorMessage ?: "Something went wrong", color = TextSecondary, fontSize = 11.sp)
                            }
                        }
                        feesList.isEmpty() -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = "No transport fees assigned. Tap + to add one.", color = TextSecondary, fontSize = 11.sp)
                            }
                        }
                        else -> {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                                modifier = Modifier.fillMaxSize()
                            ) {
                                items(feesList) { item ->
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(18.dp))
                                            .background(FrostedCard)
                                            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(18.dp))
                                            .padding(14.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .size(37.dp)
                                                    .clip(CircleShape)
                                                    .background(SunsetOrange.copy(alpha = 0.18f))
                                                    .border(width = 1.dp, color = SunsetOrange.copy(alpha = 0.4f), shape = CircleShape),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.DirectionsBus,
                                                    contentDescription = "Transport",
                                                    tint = SunsetOrange,
                                                    modifier = Modifier.size(20.dp)
                                                )
                                            }

                                            Spacer(modifier = Modifier.width(10.dp))

                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(
                                                    text = item.student_name ?: "Student #${item.student_id}",
                                                    fontSize = 13.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = TextPrimary
                                                )
                                                Spacer(modifier = Modifier.height(2.dp))
                                                Text(
                                                    text = "${item.class_name ?: ""}${if (item.class_section != null) "-${item.class_section}" else ""} • ₹${item.monthly_fee}/mo",
                                                    fontSize = 10.sp,
                                                    color = TextSecondary
                                                )
                                                Text(
                                                    text = "Since ${item.start_date}",
                                                    fontSize = 9.5.sp,
                                                    color = TextSecondary
                                                )
                                            }

                                            Switch(
                                                checked = item.status == "Active",
                                                onCheckedChange = { toggleStatus(item) },
                                                colors = SwitchDefaults.colors(checkedThumbColor = OnlineGreen)
                                            )

                                            Box {
                                                Box(
                                                    modifier = Modifier
                                                        .size(28.dp)
                                                        .clip(CircleShape)
                                                        .clickable { menuForId = item.id },
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Icon(
                                                        imageVector = Icons.Default.MoreVert,
                                                        contentDescription = "More options",
                                                        tint = TextSecondary,
                                                        modifier = Modifier.size(20.dp)
                                                    )
                                                }
                                                DropdownMenu(
                                                    expanded = menuForId == item.id,
                                                    onDismissRequest = { menuForId = null }
                                                ) {
                                                    DropdownMenuItem(
                                                        text = { Text("Edit") },
                                                        leadingIcon = { Icon(Icons.Default.Edit, contentDescription = null) },
                                                        onClick = {
                                                            menuForId = null
                                                            openEditDialog(item)
                                                        }
                                                    )
                                                    DropdownMenuItem(
                                                        text = { Text("Delete") },
                                                        onClick = {
                                                            menuForId = null
                                                            deleteTransportFee(item)
                                                        }
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

    if (showFormDialog) {
        Dialog(onDismissRequest = { resetForm() }) {
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
                        text = if (isEditing) "Edit Transport Fee" else "Assign Transport Fee",
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )

                    Spacer(modifier = Modifier.height(13.dp))

                    if (!isEditing) {
                        Text(text = "Student", fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = TextSecondary)
                        Spacer(modifier = Modifier.height(5.dp))
                        var studentDropdownExpanded by remember { mutableStateOf(false) }
                        Box(modifier = Modifier.fillMaxWidth()) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(FrostedCard)
                                    .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(14.dp))
                                    .clickable { studentDropdownExpanded = true }
                                    .padding(horizontal = 11.dp, vertical = 11.dp)
                            ) {
                                Text(
                                    text = selectedStudent?.let { "${it.name} (${it.class_name ?: ""}-${it.section ?: ""})" } ?: "Select a student",
                                    fontSize = 12.sp,
                                    color = if (selectedStudent != null) TextPrimary else TextSecondary
                                )
                            }
                            DropdownMenu(
                                expanded = studentDropdownExpanded,
                                onDismissRequest = { studentDropdownExpanded = false },
                                modifier = Modifier.heightIn(max = 300.dp)
                            ) {
                                studentsList.forEach { student ->
                                    DropdownMenuItem(
                                        text = { Text("${student.name} (${student.class_name ?: ""}-${student.section ?: ""})") },
                                        onClick = {
                                            selectedStudent = student
                                            studentDropdownExpanded = false
                                        }
                                    )
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(13.dp))
                    }

                    Text(text = "Monthly Fee", fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = TextSecondary)
                    Spacer(modifier = Modifier.height(5.dp))
                    OutlinedTextField(
                        value = monthlyFeeInput,
                        onValueChange = { monthlyFeeInput = it },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        placeholder = { Text("e.g. 1500") },
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

                    Spacer(modifier = Modifier.height(13.dp))

                    Text(text = "Start Date", fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = TextSecondary)
                    Spacer(modifier = Modifier.height(5.dp))
                    OutlinedTextField(
                        value = startDateInput,
                        onValueChange = { startDateInput = it },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        placeholder = { Text("YYYY-MM-DD") },
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

                    if (formError != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(text = formError ?: "", fontSize = 10.sp, color = Color(0xFFEF4444))
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End
                    ) {
                        TextButton(onClick = { resetForm() }) {
                            Text("Cancel", color = TextSecondary)
                        }
                        Spacer(modifier = Modifier.width(6.dp))
                        Button(
                            onClick = { saveTransportFee() },
                            enabled = !isSaving,
                            colors = ButtonDefaults.buttonColors(containerColor = SunsetOrange)
                        ) {
                            if (isSaving) {
                                ThreeDotsLoader(dotSize = 6.dp, dotColor = Color.White, spaceBetween = 4.dp, travelDistance = 4.dp)
                            } else {
                                Text("Save", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}
