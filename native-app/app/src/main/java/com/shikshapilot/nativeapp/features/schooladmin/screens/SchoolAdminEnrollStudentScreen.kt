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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
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
import com.shikshapilot.nativeapp.data.remote.ClassDto
import com.shikshapilot.nativeapp.data.remote.CreateStudentRequestDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.components.ThreeDotsLoader
import com.shikshapilot.nativeapp.ui.theme.CardBorder
import com.shikshapilot.nativeapp.ui.theme.DarkCanvas
import com.shikshapilot.nativeapp.ui.theme.FrostedCard
import com.shikshapilot.nativeapp.ui.theme.SunsetOrange
import com.shikshapilot.nativeapp.ui.theme.TextPrimary
import com.shikshapilot.nativeapp.ui.theme.TextSecondary
import kotlinx.coroutines.launch

/**
 * Full-screen student enrollment form matching web's StudentEnrollmentForm.jsx sections
 * (Student Info / Academic Info / Parent Info / Address), against POST api/school/students
 * (SchoolAdminService::createStudent). Document uploads (photo/birth-cert/aadhaar/transfer-cert/
 * report-card) are not implemented — those are file-picker flows out of scope here, matching this
 * app's existing pattern of deferring upload UI (see BACKEND_WEB_ISSUES_TODO.md/PARITY_GAPS.md).
 */
@Composable
fun SchoolAdminEnrollStudentScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    preselectClassName: String? = null,
    onBack: () -> Unit = {},
    onEnrolled: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var allClasses by remember { mutableStateOf<List<ClassDto>>(emptyList()) }
    var selectedClass by remember { mutableStateOf<ClassDto?>(null) }

    // Student Info
    var firstName by remember { mutableStateOf("") }
    var middleName by remember { mutableStateOf("") }
    var lastName by remember { mutableStateOf("") }
    var gender by remember { mutableStateOf("Male") }
    var dob by remember { mutableStateOf("") }
    var bloodGroup by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("") }
    var religion by remember { mutableStateOf("") }
    var aadhaarNo by remember { mutableStateOf("") }
    var studentMobile by remember { mutableStateOf("") }
    var studentEmail by remember { mutableStateOf("") }

    // Academic Info
    var studentCategory by remember { mutableStateOf("New Admission") }
    var rollNo by remember { mutableStateOf("") }
    var srNo by remember { mutableStateOf("") }
    var admissionDate by remember { mutableStateOf("") }
    var admissionFee by remember { mutableStateOf("") }

    // Parent Info
    var fatherName by remember { mutableStateOf("") }
    var fatherPhone by remember { mutableStateOf("") }
    var motherName by remember { mutableStateOf("") }
    var parentOccupation by remember { mutableStateOf("") }

    // Address
    var currentAddressLine by remember { mutableStateOf("") }
    var currentCity by remember { mutableStateOf("") }
    var currentState by remember { mutableStateOf("") }
    var currentCountry by remember { mutableStateOf("India") }
    var currentPinCode by remember { mutableStateOf("") }
    var sameAsCurrent by remember { mutableStateOf(true) }
    var permanentAddressLine by remember { mutableStateOf("") }
    var permanentCity by remember { mutableStateOf("") }
    var permanentState by remember { mutableStateOf("") }
    var permanentCountry by remember { mutableStateOf("India") }
    var permanentPinCode by remember { mutableStateOf("") }

    var formError by remember { mutableStateOf<String?>(null) }
    var isSaving by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        try {
            val response = RetrofitClient.apiService.getClasses()
            if (response.isSuccessful && response.body()?.data != null) {
                allClasses = response.body()!!.data
                selectedClass = allClasses.firstOrNull {
                    it.name.trim().equals(preselectClassName?.trim(), ignoreCase = true)
                }
            }
        } catch (_: Exception) {
        }
    }

    fun submit() {
        val cls = selectedClass
        if (cls == null) {
            formError = "Select a class."
            return
        }
        if (firstName.isBlank() || lastName.isBlank()) {
            formError = "First and last name are required."
            return
        }
        if (gender.isBlank()) {
            formError = "Gender is required."
            return
        }
        if (dob.isBlank()) {
            formError = "Date of birth is required."
            return
        }
        isSaving = true
        formError = null
        scope.launch {
            try {
                val response = RetrofitClient.apiService.createStudent(
                    CreateStudentRequestDto(
                        first_name = firstName.trim(),
                        middle_name = middleName.ifBlank { null },
                        last_name = lastName.trim(),
                        gender = gender,
                        dob = dob.trim(),
                        blood_group = bloodGroup.ifBlank { null },
                        category = category.ifBlank { null },
                        religion = religion.ifBlank { null },
                        aadhaar_no = aadhaarNo.ifBlank { null },
                        student_mobile = studentMobile.ifBlank { null },
                        student_email = studentEmail.ifBlank { null },
                        class_id = cls.id,
                        sr_no = srNo.ifBlank { null },
                        student_category = studentCategory,
                        roll_no = rollNo.ifBlank { null },
                        admission_date = admissionDate.ifBlank { null },
                        admission_fee = admissionFee.toDoubleOrNull(),
                        father_name = fatherName.ifBlank { null },
                        father_phone = fatherPhone.ifBlank { null },
                        mother_name = motherName.ifBlank { null },
                        parent_occupation = parentOccupation.ifBlank { null },
                        current_address_line = currentAddressLine.ifBlank { null },
                        current_city = currentCity.ifBlank { null },
                        current_state = currentState.ifBlank { null },
                        current_country = currentCountry.ifBlank { null },
                        current_pin_code = currentPinCode.ifBlank { null },
                        permanent_address_line = if (sameAsCurrent) currentAddressLine.ifBlank { null } else permanentAddressLine.ifBlank { null },
                        permanent_city = if (sameAsCurrent) currentCity.ifBlank { null } else permanentCity.ifBlank { null },
                        permanent_state = if (sameAsCurrent) currentState.ifBlank { null } else permanentState.ifBlank { null },
                        permanent_country = if (sameAsCurrent) currentCountry.ifBlank { null } else permanentCountry.ifBlank { null },
                        permanent_pin_code = if (sameAsCurrent) currentPinCode.ifBlank { null } else permanentPinCode.ifBlank { null },
                        same_as_current = if (sameAsCurrent) 1 else 0
                    )
                )
                if (response.isSuccessful) {
                    Toast.makeText(context, "Student enrolled", Toast.LENGTH_SHORT).show()
                    onEnrolled()
                    onBack()
                } else {
                    val bodyStr = response.errorBody()?.string()
                    val parsed = try {
                        bodyStr?.let {
                            val obj = com.google.gson.JsonParser().parse(it).asJsonObject
                            val errorsObj = obj.getAsJsonObject("data")?.getAsJsonObject("errors")
                            errorsObj?.entrySet()?.firstOrNull()?.value?.asString
                                ?: obj.get("message")?.asString
                        }
                    } catch (_: Exception) { null }
                    formError = parsed ?: "Failed to enroll (code ${response.code()})"
                }
            } catch (e: Exception) {
                formError = e.message ?: "Network error while enrolling"
            } finally {
                isSaving = false
            }
        }
    }

    Scaffold(containerColor = DarkCanvas) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(DarkCanvas)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                StickyTopBar(schoolName = schoolName, unreadNotificationCount = 2, onNotificationClick = {}, onAvatarClick = {})

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
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
                        Icon(imageVector = Icons.Default.ArrowBackIos, contentDescription = "Back", tint = TextPrimary, modifier = Modifier.size(16.dp))
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(text = "Enroll New Student", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                }

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp)
                ) {
                    SectionHeader("Academic Info")

                    FieldLabel("Class *")
                    ClassPicker(allClasses, selectedClass) { selectedClass = it }
                    Spacer(modifier = Modifier.height(10.dp))

                    FieldLabel("Category *")
                    ChoiceRow(listOf("New Admission", "Existing Student"), studentCategory) { studentCategory = it }
                    Spacer(modifier = Modifier.height(10.dp))

                    TwoFieldRow(
                        "SR No.", srNo, { srNo = it },
                        "Roll No.", rollNo, { rollNo = it }
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    TwoFieldRow(
                        "Admission Date (YYYY-MM-DD)", admissionDate, { admissionDate = it },
                        "Admission Fee", admissionFee, { admissionFee = it }
                    )

                    Spacer(modifier = Modifier.height(20.dp))
                    SectionHeader("Student Info")

                    TwoFieldRow(
                        "First Name *", firstName, { firstName = it },
                        "Middle Name", middleName, { middleName = it }
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    SingleField("Last Name *", lastName) { lastName = it }
                    Spacer(modifier = Modifier.height(10.dp))

                    FieldLabel("Gender *")
                    ChoiceRow(listOf("Male", "Female", "Other"), gender) { gender = it }
                    Spacer(modifier = Modifier.height(10.dp))

                    TwoFieldRow(
                        "Date of Birth (YYYY-MM-DD) *", dob, { dob = it },
                        "Blood Group", bloodGroup, { bloodGroup = it }
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    TwoFieldRow(
                        "Category (e.g. General/OBC/SC/ST)", category, { category = it },
                        "Religion", religion, { religion = it }
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    SingleField("Aadhaar No. (12 digits)", aadhaarNo) { aadhaarNo = it }
                    Spacer(modifier = Modifier.height(10.dp))
                    TwoFieldRow(
                        "Student Mobile", studentMobile, { studentMobile = it },
                        "Student Email", studentEmail, { studentEmail = it }
                    )

                    Spacer(modifier = Modifier.height(20.dp))
                    SectionHeader("Parent Info")

                    TwoFieldRow(
                        "Father Name", fatherName, { fatherName = it },
                        "Father Phone", fatherPhone, { fatherPhone = it }
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    TwoFieldRow(
                        "Mother Name", motherName, { motherName = it },
                        "Parent Occupation", parentOccupation, { parentOccupation = it }
                    )

                    Spacer(modifier = Modifier.height(20.dp))
                    SectionHeader("Current Address")

                    SingleField("Address Line", currentAddressLine) { currentAddressLine = it }
                    Spacer(modifier = Modifier.height(10.dp))
                    TwoFieldRow(
                        "City", currentCity, { currentCity = it },
                        "State", currentState, { currentState = it }
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    TwoFieldRow(
                        "Country", currentCountry, { currentCountry = it },
                        "Pin Code", currentPinCode, { currentPinCode = it }
                    )

                    Spacer(modifier = Modifier.height(14.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(text = "Permanent address same as current", fontSize = 12.5.sp, color = TextSecondary)
                        Switch(
                            checked = sameAsCurrent,
                            onCheckedChange = { sameAsCurrent = it },
                            colors = SwitchDefaults.colors(checkedThumbColor = SunsetOrange)
                        )
                    }

                    if (!sameAsCurrent) {
                        Spacer(modifier = Modifier.height(14.dp))
                        SectionHeader("Permanent Address")
                        SingleField("Address Line", permanentAddressLine) { permanentAddressLine = it }
                        Spacer(modifier = Modifier.height(10.dp))
                        TwoFieldRow(
                            "City", permanentCity, { permanentCity = it },
                            "State", permanentState, { permanentState = it }
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                        TwoFieldRow(
                            "Country", permanentCountry, { permanentCountry = it },
                            "Pin Code", permanentPinCode, { permanentPinCode = it }
                        )
                    }

                    if (formError != null) {
                        Spacer(modifier = Modifier.height(14.dp))
                        Text(text = formError ?: "", fontSize = 12.sp, color = Color(0xFFEF4444))
                    }

                    Spacer(modifier = Modifier.height(20.dp))
                    Button(
                        onClick = { submit() },
                        enabled = !isSaving,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = SunsetOrange)
                    ) {
                        if (isSaving) {
                            ThreeDotsLoader(dotSize = 6.dp, dotColor = Color.White, spaceBetween = 4.dp, travelDistance = 4.dp)
                        } else {
                            Text("Enroll Student", fontWeight = FontWeight.Bold)
                        }
                    }
                    Spacer(modifier = Modifier.height(24.dp))
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title.uppercase(),
        fontSize = 11.sp,
        fontWeight = FontWeight.ExtraBold,
        color = SunsetOrange,
        letterSpacing = 1.sp
    )
    Spacer(modifier = Modifier.height(10.dp))
}

@Composable
private fun FieldLabel(text: String) {
    Text(text = text, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextSecondary)
    Spacer(modifier = Modifier.height(6.dp))
}

@Composable
private fun SingleField(label: String, value: String, onValueChange: (String) -> Unit) {
    FieldLabel(label)
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = FrostedCard, unfocusedContainerColor = FrostedCard,
            focusedBorderColor = SunsetOrange, unfocusedBorderColor = CardBorder,
            focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary
        )
    )
}

@Composable
private fun TwoFieldRow(
    label1: String, value1: String, onChange1: (String) -> Unit,
    label2: String, value2: String, onChange2: (String) -> Unit
) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Column(modifier = Modifier.weight(1f)) {
            FieldLabel(label1)
            OutlinedTextField(
                value = value1,
                onValueChange = onChange1,
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = FrostedCard, unfocusedContainerColor = FrostedCard,
                    focusedBorderColor = SunsetOrange, unfocusedBorderColor = CardBorder,
                    focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary
                )
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            FieldLabel(label2)
            OutlinedTextField(
                value = value2,
                onValueChange = onChange2,
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = FrostedCard, unfocusedContainerColor = FrostedCard,
                    focusedBorderColor = SunsetOrange, unfocusedBorderColor = CardBorder,
                    focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary
                )
            )
        }
    }
}

@Composable
private fun ChoiceRow(options: List<String>, selected: String, onSelect: (String) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEach { option ->
            val isSelected = selected == option
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .background(if (isSelected) SunsetOrange.copy(alpha = 0.18f) else FrostedCard)
                    .border(width = 1.dp, color = if (isSelected) SunsetOrange else CardBorder, shape = RoundedCornerShape(10.dp))
                    .clickable { onSelect(option) }
                    .padding(horizontal = 12.dp, vertical = 8.dp)
            ) {
                Text(text = option, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = if (isSelected) SunsetOrange else TextPrimary)
            }
        }
    }
}

@Composable
private fun ClassPicker(classes: List<ClassDto>, selected: ClassDto?, onSelect: (ClassDto) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box(modifier = Modifier.fillMaxWidth()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(FrostedCard)
                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(14.dp))
                .clickable { expanded = true }
                .padding(horizontal = 14.dp, vertical = 14.dp)
        ) {
            Text(
                text = selected?.let { "${it.name}${it.section?.let { s -> " - $s" } ?: ""}" } ?: "Select a class",
                fontSize = 14.sp,
                color = if (selected != null) TextPrimary else TextSecondary
            )
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }, modifier = Modifier.heightIn(max = 300.dp)) {
            classes.distinctBy { it.id }.forEach { cls ->
                DropdownMenuItem(
                    text = { Text("${cls.name}${cls.section?.let { s -> " - $s" } ?: ""}") },
                    onClick = { onSelect(cls); expanded = false }
                )
            }
        }
    }
}
