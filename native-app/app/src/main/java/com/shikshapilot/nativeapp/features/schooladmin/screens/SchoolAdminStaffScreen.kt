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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.Search
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
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.shikshapilot.nativeapp.data.remote.CreateStaffRequestDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.StaffItemDto
import com.shikshapilot.nativeapp.data.remote.UpdateStaffRequestDto
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
import java.text.NumberFormat
import java.util.Locale

@Composable
fun SchoolAdminStaffScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onAvatarClick: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var searchQuery by remember { mutableStateOf("") }
    var staffList by remember { mutableStateOf<List<StaffItemDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var reloadKey by remember { mutableStateOf(0) }

    var menuForStaffId by remember { mutableStateOf<Int?>(null) }
    var showFormDialog by remember { mutableStateOf(false) }
    var isEditing by remember { mutableStateOf(false) }
    var editingId by remember { mutableStateOf<Int?>(null) }
    var nameInput by remember { mutableStateOf("") }
    var fatherNameInput by remember { mutableStateOf("") }
    var motherNameInput by remember { mutableStateOf("") }
    var phoneInput by remember { mutableStateOf("") }
    var emailInput by remember { mutableStateOf("") }
    var roleInput by remember { mutableStateOf("Teacher") }
    var departmentInput by remember { mutableStateOf("") }
    var joiningDateInput by remember { mutableStateOf("") }
    var salaryInput by remember { mutableStateOf("") }
    var formError by remember { mutableStateOf<String?>(null) }
    var isSaving by remember { mutableStateOf(false) }

    var deactivateTarget by remember { mutableStateOf<StaffItemDto?>(null) }
    var isDeactivating by remember { mutableStateOf(false) }

    fun resetForm() {
        showFormDialog = false
        isEditing = false
        editingId = null
        nameInput = ""
        fatherNameInput = ""
        motherNameInput = ""
        phoneInput = ""
        emailInput = ""
        roleInput = "Teacher"
        departmentInput = ""
        joiningDateInput = ""
        salaryInput = ""
        formError = null
    }

    fun openAddDialog() {
        resetForm()
        showFormDialog = true
    }

    fun openEditDialog(staff: StaffItemDto) {
        isEditing = true
        editingId = staff.id
        nameInput = staff.name
        fatherNameInput = staff.father_name ?: ""
        motherNameInput = staff.mother_name ?: ""
        phoneInput = staff.phone ?: ""
        emailInput = staff.email ?: ""
        roleInput = staff.role ?: "Teacher"
        departmentInput = staff.department ?: ""
        joiningDateInput = staff.joining_date ?: ""
        salaryInput = (staff.salary ?: 0.0).let { if (it == it.toLong().toDouble()) it.toLong().toString() else it.toString() }
        formError = null
        showFormDialog = true
    }

    fun saveStaff() {
        val name = nameInput.trim()
        val fatherName = fatherNameInput.trim()
        val motherName = motherNameInput.trim()
        val phone = phoneInput.trim()
        val joiningDate = joiningDateInput.trim()
        val salary = salaryInput.trim().toDoubleOrNull()

        if (name.length < 3) { formError = "Name must be at least 3 characters."; return }
        if (fatherName.length < 3) { formError = "Father's name must be at least 3 characters."; return }
        if (motherName.length < 3) { formError = "Mother's name must be at least 3 characters."; return }
        if (!phone.matches(Regex("^[0-9]{10}$"))) { formError = "Contact number must be exactly 10 digits."; return }
        if (!joiningDate.matches(Regex("^\\d{4}-\\d{2}-\\d{2}$"))) { formError = "Joining date must be in YYYY-MM-DD format."; return }
        if (salary == null || salary <= 0) { formError = "Salary must be a positive number."; return }

        isSaving = true
        formError = null
        scope.launch {
            try {
                val response = if (isEditing && editingId != null) {
                    RetrofitClient.apiService.updateStaff(
                        editingId!!,
                        UpdateStaffRequestDto(
                            name = name,
                            father_name = fatherName,
                            mother_name = motherName,
                            phone = phone,
                            joining_date = joiningDate,
                            salary = salary,
                            role = roleInput,
                            department = departmentInput.trim().ifEmpty { null },
                            email = emailInput.trim().ifEmpty { null }
                        )
                    )
                } else {
                    RetrofitClient.apiService.createStaff(
                        CreateStaffRequestDto(
                            name = name,
                            father_name = fatherName,
                            mother_name = motherName,
                            phone = phone,
                            joining_date = joiningDate,
                            salary = salary,
                            role = roleInput,
                            department = departmentInput.trim().ifEmpty { null },
                            email = emailInput.trim().ifEmpty { null }
                        )
                    )
                }
                if (response.isSuccessful) {
                    Toast.makeText(context, if (isEditing) "Staff updated" else "Staff added", Toast.LENGTH_SHORT).show()
                    resetForm()
                    reloadKey++
                } else {
                    formError = "Failed to save staff (code ${response.code()})"
                }
            } catch (e: Exception) {
                formError = e.message ?: "Network error while saving staff"
            } finally {
                isSaving = false
            }
        }
    }

    fun deactivateStaff(staff: StaffItemDto) {
        isDeactivating = true
        scope.launch {
            try {
                val today = java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US).format(java.util.Date())
                val response = RetrofitClient.apiService.updateStaff(
                    staff.id,
                    UpdateStaffRequestDto(
                        name = staff.name,
                        father_name = staff.father_name ?: staff.name,
                        mother_name = staff.mother_name ?: staff.name,
                        phone = staff.phone ?: "",
                        joining_date = staff.joining_date ?: today,
                        salary = staff.salary ?: 0.0,
                        role = staff.role,
                        department = staff.department,
                        email = staff.email,
                        status = "Inactive",
                        exit_date = today
                    )
                )
                if (response.isSuccessful) {
                    Toast.makeText(context, "${staff.name} marked inactive", Toast.LENGTH_SHORT).show()
                    deactivateTarget = null
                    reloadKey++
                } else {
                    Toast.makeText(context, "Failed to deactivate (code ${response.code()})", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, e.message ?: "Network error", Toast.LENGTH_SHORT).show()
            } finally {
                isDeactivating = false
            }
        }
    }

    // Live QA Server API Staff Request
    LaunchedEffect(searchQuery, reloadKey) {
        isLoading = true
        try {
            val response = RetrofitClient.apiService.getStaff(
                search = searchQuery.ifEmpty { null }
            )
            if (response.isSuccessful && response.body()?.data != null) {
                staffList = response.body()!!.data
            }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            isLoading = false
        }
    }

    Scaffold(
        containerColor = DarkCanvas,
        floatingActionButton = {
            FloatingActionButton(
                onClick = { openAddDialog() },
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
            PullToRefreshWrapper(isRefreshing = isLoading, onRefresh = { reloadKey++ }) {
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
                    // Back & Header Row
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
                                text = "Staff Governance & Payroll",
                                fontSize = 15.5.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "${staffList.size} Active Staff Members (QA Live API)",
                                fontSize = 10.sp,
                                color = SunsetOrange
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(11.dp))

                    // Search Bar
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        placeholder = { Text("Search by Staff Name or Department...", color = TextSecondary, fontSize = 11.5.sp) },
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

                    Spacer(modifier = Modifier.height(11.dp))

                    // Dynamic Staff List
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
                    } else if (staffList.isEmpty()) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = "No staff records found", color = TextSecondary, fontSize = 12.sp)
                        }
                    } else {
                        LazyColumn(
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.fillMaxSize()
                        ) {
                            items(staffList) { staff ->
                                val empCode = staff.employee_id ?: "EMP-NA"
                                val deptStr = staff.department ?: "General"
                                val roleStr = staff.role ?: "Teacher"
                                val phoneStr = staff.phone ?: "Phone N/A"
                                val salaryFormatted = try {
                                    val valLong = (staff.salary ?: 0.0).toLong()
                                    "₹ " + NumberFormat.getNumberInstance(Locale("en", "IN")).format(valLong)
                                } catch (e: Exception) {
                                    "₹ ${staff.salary ?: 0.0}"
                                }

                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(18.dp))
                                        .background(FrostedCard)
                                        .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(18.dp))
                                        .padding(14.dp)
                                ) {
                                    Column(modifier = Modifier.fillMaxWidth()) {
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
                                                    imageVector = Icons.Default.Groups,
                                                    contentDescription = "Staff",
                                                    tint = SunsetOrange,
                                                    modifier = Modifier.size(20.dp)
                                                )
                                            }

                                            Spacer(modifier = Modifier.width(10.dp))

                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(
                                                    text = staff.name,
                                                    fontSize = 13.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = TextPrimary
                                                )
                                                Text(
                                                    text = "$roleStr ($deptStr) • $phoneStr",
                                                    fontSize = 10.sp,
                                                    color = TextSecondary
                                                )
                                            }

                                            Text(
                                                text = salaryFormatted,
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.ExtraBold,
                                                color = OnlineGreen
                                            )

                                            Spacer(modifier = Modifier.width(3.dp))

                                            Box {
                                                Box(
                                                    modifier = Modifier
                                                        .size(25.dp)
                                                        .clip(CircleShape)
                                                        .clickable { menuForStaffId = staff.id },
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
                                                    expanded = menuForStaffId == staff.id,
                                                    onDismissRequest = { menuForStaffId = null }
                                                ) {
                                                    DropdownMenuItem(
                                                        text = { Text("Edit") },
                                                        onClick = {
                                                            menuForStaffId = null
                                                            openEditDialog(staff)
                                                        }
                                                    )
                                                    if ((staff.status ?: "ACTIVE").equals("ACTIVE", ignoreCase = true)) {
                                                        DropdownMenuItem(
                                                            text = { Text("Deactivate") },
                                                            onClick = {
                                                                menuForStaffId = null
                                                                deactivateTarget = staff
                                                            }
                                                        )
                                                    }
                                                }
                                            }
                                        }

                                        Spacer(modifier = Modifier.height(8.dp))

                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(6.dp))
                                                    .background(OnlineGreen.copy(alpha = 0.2f))
                                                    .padding(horizontal = 7.dp, vertical = 2.dp)
                                            ) {
                                                Text(
                                                    text = "$empCode • ${staff.status ?: "ACTIVE"}",
                                                    fontSize = 9.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = OnlineGreen
                                                )
                                            }

                                            // Disburse Salary Action
                                            Box(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(10.dp))
                                                    .background(SunsetOrange)
                                                    .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(10.dp))
                                                    .clickable {
                                                        Toast.makeText(context, "Salary receipt generated for ${staff.name}", Toast.LENGTH_SHORT).show()
                                                    }
                                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                                            ) {
                                                Row(verticalAlignment = Alignment.CenterVertically) {
                                                    Icon(
                                                        imageVector = Icons.Default.ReceiptLong,
                                                        contentDescription = "Pay",
                                                        tint = Color.White,
                                                        modifier = Modifier.size(20.dp)
                                                    )
                                                    Spacer(modifier = Modifier.width(3.dp))
                                                    Text(
                                                        text = "Disburse Salary",
                                                        fontSize = 10.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = Color.White
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
                Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (isEditing) "Edit Staff" else "Add Staff",
                            fontSize = 13.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Close",
                            tint = TextSecondary,
                            modifier = Modifier.clickable { resetForm() }
                        )
                    }

                    Spacer(modifier = Modifier.height(11.dp))

                    StaffFormField(label = "Name *", value = nameInput, onValueChange = { nameInput = it })
                    Spacer(modifier = Modifier.height(8.dp))
                    StaffFormField(label = "Father's Name *", value = fatherNameInput, onValueChange = { fatherNameInput = it })
                    Spacer(modifier = Modifier.height(8.dp))
                    StaffFormField(label = "Mother's Name *", value = motherNameInput, onValueChange = { motherNameInput = it })
                    Spacer(modifier = Modifier.height(8.dp))
                    StaffFormField(
                        label = "Phone (10 digits) *",
                        value = phoneInput,
                        onValueChange = { if (it.length <= 10 && it.all { c -> c.isDigit() }) phoneInput = it },
                        keyboardType = KeyboardType.Number
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    StaffFormField(label = "Email (optional)", value = emailInput, onValueChange = { emailInput = it }, keyboardType = KeyboardType.Email)
                    Spacer(modifier = Modifier.height(8.dp))
                    StaffFormField(label = "Role", value = roleInput, onValueChange = { roleInput = it })
                    Spacer(modifier = Modifier.height(8.dp))
                    StaffFormField(label = "Department (optional)", value = departmentInput, onValueChange = { departmentInput = it })
                    Spacer(modifier = Modifier.height(8.dp))
                    StaffFormField(label = "Joining Date (YYYY-MM-DD) *", value = joiningDateInput, onValueChange = { joiningDateInput = it })
                    Spacer(modifier = Modifier.height(8.dp))
                    StaffFormField(label = "Monthly Salary *", value = salaryInput, onValueChange = { salaryInput = it }, keyboardType = KeyboardType.Number)

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
                            onClick = { saveStaff() },
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

    if (deactivateTarget != null) {
        AlertDialog(
            onDismissRequest = { if (!isDeactivating) deactivateTarget = null },
            title = { Text("Deactivate ${deactivateTarget?.name}?") },
            text = { Text("This marks the staff member as inactive with today's exit date. Their record is preserved, not deleted.") },
            confirmButton = {
                TextButton(
                    onClick = { deactivateTarget?.let { deactivateStaff(it) } },
                    enabled = !isDeactivating
                ) {
                    Text(if (isDeactivating) "Deactivating..." else "Deactivate", color = Color(0xFFEF4444))
                }
            },
            dismissButton = {
                TextButton(onClick = { deactivateTarget = null }, enabled = !isDeactivating) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
private fun StaffFormField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    keyboardType: KeyboardType = KeyboardType.Text
) {
    Column {
        Text(text = label, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = TextSecondary)
        Spacer(modifier = Modifier.height(5.dp))
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth().height(48.dp),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
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
    }
}
