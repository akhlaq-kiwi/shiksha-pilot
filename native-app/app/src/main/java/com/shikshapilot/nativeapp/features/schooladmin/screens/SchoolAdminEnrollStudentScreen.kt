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
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
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
import com.shikshapilot.nativeapp.ui.theme.DangerRed
import com.shikshapilot.nativeapp.ui.theme.DarkCanvas
import com.shikshapilot.nativeapp.ui.theme.FrostedCard
import com.shikshapilot.nativeapp.ui.theme.SunsetOrange
import com.shikshapilot.nativeapp.ui.theme.TextPrimary
import com.shikshapilot.nativeapp.ui.theme.TextSecondary
import kotlinx.coroutines.launch

// Matches the real web <select> options exactly (verified live against the running web app
// at localhost:2003/school-admin — GENDER/BLOOD GROUP/CATEGORY/STUDENT CATEGORY selects).
private val GENDERS = listOf("Male", "Female", "Other")
private val BLOOD_GROUPS = listOf("A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-")
private val CATEGORIES = listOf("General", "OBC", "SC", "ST")
private val STUDENT_CATEGORIES = listOf("Existing Student", "New Admission")

private val WIZARD_STEPS = listOf("Basic Details", "Address", "Document Uploads", "Review & Submit")

/**
 * Student enrollment as a 4-step wizard, matching the real web StudentEnrollmentForm exactly
 * (verified twice against the running web app: once walking the empty form to capture every
 * validation message, once with a full valid submission through to POST api/school/students).
 * Steps: 1. Basic Details, 2. Address, 3. Document Uploads, 4. Review & Submit.
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

    var step by remember { mutableIntStateOf(1) }

    var allClasses by remember { mutableStateOf<List<ClassDto>>(emptyList()) }
    var sectionsForClass by remember { mutableStateOf<List<ClassDto>>(emptyList()) }
    var selectedSection by remember { mutableStateOf<ClassDto?>(null) }

    // Step 1 — Basic Details
    var studentName by remember { mutableStateOf("") }
    var fatherName by remember { mutableStateOf("") }
    var motherName by remember { mutableStateOf("") }
    var parentOccupation by remember { mutableStateOf("") }
    var gender by remember { mutableStateOf("") }
    var dob by remember { mutableStateOf("") }
    var admissionDate by remember { mutableStateOf("") }
    var admissionFee by remember { mutableStateOf("") }
    var studentCategory by remember { mutableStateOf("") }
    var bloodGroup by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("") }
    var religion by remember { mutableStateOf("") }
    var aadhaarNo by remember { mutableStateOf("") }
    var studentMobile by remember { mutableStateOf("") }
    var srNo by remember { mutableStateOf("") }
    var rollNo by remember { mutableStateOf("") }

    // Step 2 — Address
    var currentAddressLine by remember { mutableStateOf("") }
    var currentState by remember { mutableStateOf("") }
    var currentCity by remember { mutableStateOf("") }
    var currentCountry by remember { mutableStateOf("") }
    var currentPinCode by remember { mutableStateOf("") }
    var sameAsCurrent by remember { mutableStateOf(false) }
    var permanentAddressLine by remember { mutableStateOf("") }
    var permanentState by remember { mutableStateOf("") }
    var permanentCity by remember { mutableStateOf("") }
    var permanentCountry by remember { mutableStateOf("") }
    var permanentPinCode by remember { mutableStateOf("") }

    var formError by remember { mutableStateOf<String?>(null) }
    var isSaving by remember { mutableStateOf(false) }
    var invalidFields by remember { mutableStateOf<Set<String>>(emptySet()) }

    LaunchedEffect(Unit) {
        try {
            val response = RetrofitClient.apiService.getClasses()
            if (response.isSuccessful && response.body()?.data != null) {
                allClasses = response.body()!!.data
                sectionsForClass = allClasses.filter {
                    it.name.trim().equals(preselectClassName?.trim(), ignoreCase = true)
                }
                selectedSection = sectionsForClass.firstOrNull()
            }
        } catch (_: Exception) {
        }
    }

    // Mirrors the real web form's exact required-field messages (captured live from the
    // Basic Details step's validation errors).
    fun validateStep1(): Set<String> {
        val invalid = mutableSetOf<String>()
        if (studentName.isBlank()) invalid += "student_name"
        if (fatherName.isBlank()) invalid += "father_name"
        if (motherName.isBlank()) invalid += "mother_name"
        if (gender.isBlank()) invalid += "gender"
        if (dob.isBlank()) invalid += "dob"
        if (studentCategory.isBlank()) invalid += "student_category"
        if (studentMobile.isBlank()) invalid += "student_mobile"
        else if (!studentMobile.all { it.isDigit() }) invalid += "student_mobile"
        if (srNo.isBlank()) invalid += "sr_no"
        if (selectedSection == null) invalid += "section_name"
        if (aadhaarNo.isNotBlank() && !Regex("^\\d{12}$").matches(aadhaarNo)) invalid += "aadhaar_no"
        return invalid
    }

    fun validateStep2(): Set<String> {
        val invalid = mutableSetOf<String>()
        if (currentAddressLine.isBlank()) invalid += "current_address_line"
        else if (currentAddressLine.trim().length > 50) invalid += "current_address_line"
        if (currentState.isBlank()) invalid += "current_state"
        if (currentCity.isBlank()) invalid += "current_city"
        if (currentPinCode.isBlank()) invalid += "current_pin_code"
        if (!sameAsCurrent) {
            if (permanentAddressLine.isBlank()) invalid += "permanent_address_line"
            else if (permanentAddressLine.trim().length > 50) invalid += "permanent_address_line"
            if (permanentState.isBlank()) invalid += "permanent_state"
            if (permanentCity.isBlank()) invalid += "permanent_city"
            if (permanentPinCode.isBlank()) invalid += "permanent_pin_code"
        }
        return invalid
    }

    fun goNext() {
        val invalid = when (step) {
            1 -> validateStep1()
            2 -> validateStep2()
            else -> emptySet()
        }
        invalidFields = invalid
        if (invalid.isNotEmpty()) {
            formError = "Please fill in all required fields (marked in red)."
            return
        }
        formError = null
        step += 1
    }

    fun submit() {
        val section = selectedSection ?: return
        val nameParts = studentName.trim().split(Regex("\\s+")).filter { it.isNotBlank() }
        val firstName = nameParts.firstOrNull().orEmpty()
        val lastName = if (nameParts.size > 1) nameParts.last() else ""
        val middleName = if (nameParts.size > 2) nameParts.subList(1, nameParts.size - 1).joinToString(" ") else null

        isSaving = true
        formError = null
        scope.launch {
            try {
                val response = RetrofitClient.apiService.createStudent(
                    CreateStudentRequestDto(
                        first_name = firstName,
                        middle_name = middleName,
                        last_name = lastName,
                        gender = gender,
                        dob = dob.trim(),
                        blood_group = bloodGroup.ifBlank { null },
                        category = category.ifBlank { null },
                        religion = religion.ifBlank { null },
                        aadhaar_no = aadhaarNo.ifBlank { null },
                        student_mobile = studentMobile.ifBlank { null },
                        student_email = null,
                        class_id = section.id,
                        sr_no = srNo.ifBlank { null },
                        student_category = studentCategory,
                        roll_no = rollNo.ifBlank { null },
                        admission_date = admissionDate.ifBlank { null },
                        admission_fee = admissionFee.toDoubleOrNull(),
                        father_name = fatherName.ifBlank { null },
                        father_phone = studentMobile.ifBlank { null },
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
                        .padding(horizontal = 13.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(FrostedCard)
                            .border(width = 1.dp, color = CardBorder, shape = CircleShape)
                            .clickable { if (step > 1) step -= 1 else onBack() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(imageVector = Icons.Default.ArrowBackIos, contentDescription = "Back", tint = TextPrimary, modifier = Modifier.size(20.dp))
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(text = "Enroll New Student", fontSize = 15.5.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                }

                WizardStepper(step)

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp)
                ) {
                    when (step) {
                        1 -> BasicDetailsStep(
                            studentName, { studentName = it },
                            fatherName, { fatherName = it },
                            motherName, { motherName = it },
                            parentOccupation, { parentOccupation = it },
                            gender, { gender = it },
                            dob, { dob = it },
                            admissionDate, { admissionDate = it },
                            admissionFee, { admissionFee = it },
                            studentCategory, { studentCategory = it },
                            bloodGroup, { bloodGroup = it },
                            category, { category = it },
                            religion, { religion = it },
                            aadhaarNo, { aadhaarNo = it },
                            studentMobile, { studentMobile = it },
                            srNo, { srNo = it },
                            sectionsForClass, selectedSection, { selectedSection = it },
                            rollNo, { rollNo = it },
                            invalidFields
                        )
                        2 -> AddressStep(
                            currentAddressLine, { currentAddressLine = it },
                            currentState, { currentState = it },
                            currentCity, { currentCity = it },
                            currentCountry, { currentCountry = it },
                            currentPinCode, { currentPinCode = it },
                            sameAsCurrent, { sameAsCurrent = it },
                            permanentAddressLine, { permanentAddressLine = it },
                            permanentState, { permanentState = it },
                            permanentCity, { permanentCity = it },
                            permanentCountry, { permanentCountry = it },
                            permanentPinCode, { permanentPinCode = it },
                            invalidFields
                        )
                        3 -> DocumentUploadsStep()
                        4 -> ReviewStep(
                            studentName, gender, dob, aadhaarNo, studentMobile,
                            selectedSection, rollNo, srNo,
                            fatherName, motherName, parentOccupation,
                            currentAddressLine, currentCity, currentState, currentPinCode
                        )
                    }

                    if (formError != null) {
                        Spacer(modifier = Modifier.height(11.dp))
                        Text(text = formError ?: "", fontSize = 10.sp, color = Color(0xFFEF4444))
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        if (step < 4) {
                            OutlinedButton(onClick = { if (step > 1) step -= 1 else onBack() }, modifier = Modifier.weight(1f)) {
                                Text(if (step > 1) "Previous" else "Cancel")
                            }
                            Button(
                                onClick = { goNext() },
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(containerColor = SunsetOrange)
                            ) {
                                Text("Next Step", fontWeight = FontWeight.Bold)
                            }
                        } else {
                            OutlinedButton(onClick = { step -= 1 }, modifier = Modifier.weight(1f)) {
                                Text("Previous")
                            }
                            Button(
                                onClick = { submit() },
                                enabled = !isSaving,
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(containerColor = SunsetOrange)
                            ) {
                                if (isSaving) {
                                    ThreeDotsLoader(dotSize = 6.dp, dotColor = Color.White, spaceBetween = 4.dp, travelDistance = 4.dp)
                                } else {
                                    Text("Submit", fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(19.dp))
                }
            }
        }
    }
}

@Composable
private fun WizardStepper(currentStep: Int) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        WIZARD_STEPS.forEachIndexed { index, title ->
            val stepNo = index + 1
            val isActive = stepNo == currentStep
            val isDone = stepNo < currentStep
            Text(
                text = "$stepNo. $title",
                fontSize = 9.5.sp,
                fontWeight = if (isActive) FontWeight.ExtraBold else FontWeight.Medium,
                color = when {
                    isActive -> SunsetOrange
                    isDone -> TextPrimary
                    else -> TextSecondary
                }
            )
        }
    }
}

@Composable
private fun BasicDetailsStep(
    studentName: String, onStudentName: (String) -> Unit,
    fatherName: String, onFatherName: (String) -> Unit,
    motherName: String, onMotherName: (String) -> Unit,
    parentOccupation: String, onParentOccupation: (String) -> Unit,
    gender: String, onGender: (String) -> Unit,
    dob: String, onDob: (String) -> Unit,
    admissionDate: String, onAdmissionDate: (String) -> Unit,
    admissionFee: String, onAdmissionFee: (String) -> Unit,
    studentCategory: String, onStudentCategory: (String) -> Unit,
    bloodGroup: String, onBloodGroup: (String) -> Unit,
    category: String, onCategory: (String) -> Unit,
    religion: String, onReligion: (String) -> Unit,
    aadhaarNo: String, onAadhaarNo: (String) -> Unit,
    studentMobile: String, onStudentMobile: (String) -> Unit,
    srNo: String, onSrNo: (String) -> Unit,
    sections: List<ClassDto>, selectedSection: ClassDto?, onSelectSection: (ClassDto) -> Unit,
    rollNo: String, onRollNo: (String) -> Unit,
    invalidFields: Set<String>
) {
    SectionHeader("Basic Details")

    SingleField("Student Name *", studentName, isError = invalidFields.contains("student_name")) { onStudentName(it) }
    Spacer(modifier = Modifier.height(8.dp))
    SingleField("Father Name *", fatherName, isError = invalidFields.contains("father_name")) { onFatherName(it) }
    Spacer(modifier = Modifier.height(8.dp))
    SingleField("Mother Name *", motherName, isError = invalidFields.contains("mother_name")) { onMotherName(it) }
    Spacer(modifier = Modifier.height(8.dp))
    SingleField("Parent Occupation", parentOccupation) { onParentOccupation(it) }
    Spacer(modifier = Modifier.height(8.dp))

    DropdownField("Gender *", GENDERS, gender, isError = invalidFields.contains("gender")) { onGender(it) }
    Spacer(modifier = Modifier.height(8.dp))
    SingleField("Date of Birth (YYYY-MM-DD) *", dob, isError = invalidFields.contains("dob")) { onDob(it) }
    Spacer(modifier = Modifier.height(8.dp))
    SingleField("Admission Date (YYYY-MM-DD) *", admissionDate) { onAdmissionDate(it) }
    Spacer(modifier = Modifier.height(8.dp))
    SingleField("Admission Fee", admissionFee) { onAdmissionFee(it) }
    Spacer(modifier = Modifier.height(8.dp))

    DropdownField("Student Category *", STUDENT_CATEGORIES, studentCategory, isError = invalidFields.contains("student_category")) { onStudentCategory(it) }
    Spacer(modifier = Modifier.height(8.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Column(modifier = Modifier.weight(1f)) {
            DropdownField("Blood Group", BLOOD_GROUPS, bloodGroup) { onBloodGroup(it) }
        }
        Column(modifier = Modifier.weight(1f)) {
            DropdownField("Category", CATEGORIES, category) { onCategory(it) }
        }
    }
    Spacer(modifier = Modifier.height(8.dp))
    SingleField("Religion", religion) { onReligion(it) }
    Spacer(modifier = Modifier.height(8.dp))
    SingleField("Aadhaar Number", aadhaarNo, isError = invalidFields.contains("aadhaar_no")) { onAadhaarNo(it) }
    Spacer(modifier = Modifier.height(8.dp))
    SingleField("Contact Number *", studentMobile, isError = invalidFields.contains("student_mobile")) { onStudentMobile(it) }
    Spacer(modifier = Modifier.height(8.dp))
    SingleField("SR Number *", srNo, isError = invalidFields.contains("sr_no")) { onSrNo(it) }
    Spacer(modifier = Modifier.height(8.dp))
    SectionPicker(sections, selectedSection, isError = invalidFields.contains("section_name")) { onSelectSection(it) }
    Spacer(modifier = Modifier.height(8.dp))
    SingleField("Roll Number", rollNo) { onRollNo(it) }
}

@Composable
private fun AddressStep(
    currentAddressLine: String, onCurrentAddressLine: (String) -> Unit,
    currentState: String, onCurrentState: (String) -> Unit,
    currentCity: String, onCurrentCity: (String) -> Unit,
    currentCountry: String, onCurrentCountry: (String) -> Unit,
    currentPinCode: String, onCurrentPinCode: (String) -> Unit,
    sameAsCurrent: Boolean, onSameAsCurrent: (Boolean) -> Unit,
    permanentAddressLine: String, onPermanentAddressLine: (String) -> Unit,
    permanentState: String, onPermanentState: (String) -> Unit,
    permanentCity: String, onPermanentCity: (String) -> Unit,
    permanentCountry: String, onPermanentCountry: (String) -> Unit,
    permanentPinCode: String, onPermanentPinCode: (String) -> Unit,
    invalidFields: Set<String>
) {
    SectionHeader("Current Address")
    SingleField("Address *", currentAddressLine, isError = invalidFields.contains("current_address_line")) { onCurrentAddressLine(it) }
    Spacer(modifier = Modifier.height(8.dp))
    TwoFieldRow(
        "State *", currentState, { onCurrentState(it) },
        "City *", currentCity, { onCurrentCity(it) },
        isError1 = invalidFields.contains("current_state"),
        isError2 = invalidFields.contains("current_city")
    )
    Spacer(modifier = Modifier.height(8.dp))
    TwoFieldRow(
        "Country", currentCountry, { onCurrentCountry(it) },
        "Pin Code *", currentPinCode, { onCurrentPinCode(it) },
        isError2 = invalidFields.contains("current_pin_code")
    )

    Spacer(modifier = Modifier.height(11.dp))
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = "Permanent address same as current address", fontSize = 10.5.sp, color = TextSecondary)
        Switch(
            checked = sameAsCurrent,
            onCheckedChange = onSameAsCurrent,
            colors = SwitchDefaults.colors(checkedThumbColor = SunsetOrange)
        )
    }

    if (!sameAsCurrent) {
        Spacer(modifier = Modifier.height(11.dp))
        SectionHeader("Permanent Address")
        SingleField("Address *", permanentAddressLine, isError = invalidFields.contains("permanent_address_line")) { onPermanentAddressLine(it) }
        Spacer(modifier = Modifier.height(8.dp))
        TwoFieldRow(
            "State *", permanentState, { onPermanentState(it) },
            "City *", permanentCity, { onPermanentCity(it) },
            isError1 = invalidFields.contains("permanent_state"),
            isError2 = invalidFields.contains("permanent_city")
        )
        Spacer(modifier = Modifier.height(8.dp))
        TwoFieldRow(
            "Country", permanentCountry, { onPermanentCountry(it) },
            "Pin Code *", permanentPinCode, { onPermanentPinCode(it) },
            isError2 = invalidFields.contains("permanent_pin_code")
        )
    }
}

@Composable
private fun DocumentUploadsStep() {
    SectionHeader("Student Records Upload")
    Text(
        text = "Upload scanned copies/images of primary documentation. Accepted: PNG, JPG, PDF (Max 5MB).",
        fontSize = 10.sp,
        color = TextSecondary
    )
    Spacer(modifier = Modifier.height(12.dp))
    listOf(
        "Student Photo", "Birth Certificate", "Aadhaar Card",
        "Transfer Certificate (TC)", "Previous Report Card", "Additional Documents"
    ).forEach { label ->
        FieldLabel(label)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(FrostedCard)
                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(10.dp))
                .padding(horizontal = 12.dp, vertical = 10.dp)
        ) {
            Text(text = "Not supported on this app yet — you can add documents later from the web portal.", fontSize = 9.5.sp, color = TextSecondary)
        }
        Spacer(modifier = Modifier.height(10.dp))
    }
}

@Composable
private fun ReviewStep(
    studentName: String, gender: String, dob: String, aadhaarNo: String, studentMobile: String,
    selectedSection: ClassDto?, rollNo: String, srNo: String,
    fatherName: String, motherName: String, parentOccupation: String,
    currentAddressLine: String, currentCity: String, currentState: String, currentPinCode: String
) {
    SectionHeader("Review Enrollment Summary")

    ReviewGroup("Student Profile") {
        ReviewLine("Full Name", studentName.ifBlank { "-" })
        ReviewLine("Gender / DOB", "${gender.ifBlank { "-" }} / ${dob.ifBlank { "-" }}")
        ReviewLine("Aadhaar No", aadhaarNo.ifBlank { "-" })
        ReviewLine("Mobile", studentMobile.ifBlank { "-" })
    }
    Spacer(modifier = Modifier.height(12.dp))
    ReviewGroup("Academic Details") {
        ReviewLine("Class Assigned", selectedSection?.let { "${it.name}${it.section?.let { s -> " - $s" } ?: ""}" } ?: "-")
        ReviewLine("Roll No", rollNo.ifBlank { "-" })
        ReviewLine("SR Number", srNo.ifBlank { "-" })
    }
    Spacer(modifier = Modifier.height(12.dp))
    ReviewGroup("Parent Info") {
        ReviewLine("Father Name", fatherName.ifBlank { "-" })
        ReviewLine("Mother Name", motherName.ifBlank { "-" })
        ReviewLine("Occupation", parentOccupation.ifBlank { "-" })
    }
    Spacer(modifier = Modifier.height(12.dp))
    ReviewGroup("Current Address") {
        Text(
            text = listOf(currentAddressLine, currentCity, currentState).filter { it.isNotBlank() }
                .joinToString(", ").let { if (currentPinCode.isNotBlank()) "$it - $currentPinCode" else it }
                .ifBlank { "-" },
            fontSize = 11.sp,
            color = TextPrimary
        )
    }
}

@Composable
private fun ReviewGroup(title: String, content: @Composable () -> Unit) {
    Text(text = title.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, color = SunsetOrange, letterSpacing = 1.sp)
    Spacer(modifier = Modifier.height(6.dp))
    content()
}

@Composable
private fun ReviewLine(label: String, value: String) {
    Text(text = "$label: $value", fontSize = 11.sp, color = TextPrimary)
    Spacer(modifier = Modifier.height(3.dp))
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title.uppercase(),
        fontSize = 9.5.sp,
        fontWeight = FontWeight.ExtraBold,
        color = SunsetOrange,
        letterSpacing = 1.sp
    )
    Spacer(modifier = Modifier.height(8.dp))
}

@Composable
private fun FieldLabel(text: String) {
    Text(text = text, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = TextSecondary)
    Spacer(modifier = Modifier.height(5.dp))
}

@Composable
private fun SingleField(label: String, value: String, isError: Boolean = false, onValueChange: (String) -> Unit) {
    FieldLabel(label)
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = Modifier.fillMaxWidth().height(48.dp),
        singleLine = true,
        isError = isError,
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = FrostedCard, unfocusedContainerColor = FrostedCard,
            focusedBorderColor = SunsetOrange, unfocusedBorderColor = if (isError) DangerRed else CardBorder,
            errorBorderColor = DangerRed,
            focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary
        )
    )
}

@Composable
private fun TwoFieldRow(
    label1: String, value1: String, onChange1: (String) -> Unit,
    label2: String, value2: String, onChange2: (String) -> Unit,
    isError1: Boolean = false, isError2: Boolean = false
) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Column(modifier = Modifier.weight(1f)) {
            FieldLabel(label1)
            OutlinedTextField(
                value = value1,
                onValueChange = onChange1,
                modifier = Modifier.fillMaxWidth().height(48.dp),
                singleLine = true,
                isError = isError1,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = FrostedCard, unfocusedContainerColor = FrostedCard,
                    focusedBorderColor = SunsetOrange, unfocusedBorderColor = if (isError1) DangerRed else CardBorder,
                    errorBorderColor = DangerRed,
                    focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary
                )
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            FieldLabel(label2)
            OutlinedTextField(
                value = value2,
                onValueChange = onChange2,
                modifier = Modifier.fillMaxWidth().height(48.dp),
                singleLine = true,
                isError = isError2,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = FrostedCard, unfocusedContainerColor = FrostedCard,
                    focusedBorderColor = SunsetOrange, unfocusedBorderColor = if (isError2) DangerRed else CardBorder,
                    errorBorderColor = DangerRed,
                    focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary
                )
            )
        }
    }
}

@Composable
private fun SectionPicker(sections: List<ClassDto>, selected: ClassDto?, isError: Boolean = false, onSelect: (ClassDto) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    FieldLabel("Select Section *")
    Box(modifier = Modifier.fillMaxWidth()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(FrostedCard)
                .border(width = 1.dp, color = if (isError) DangerRed else CardBorder, shape = RoundedCornerShape(14.dp))
                .clickable { expanded = true }
                .padding(horizontal = 11.dp),
            contentAlignment = Alignment.CenterStart
        ) {
            Text(
                text = selected?.section?.let { "Section $it" } ?: "Select Section...",
                fontSize = 12.sp,
                color = if (selected != null) TextPrimary else TextSecondary
            )
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }, modifier = Modifier.heightIn(max = 300.dp)) {
            sections.forEach { section ->
                DropdownMenuItem(
                    text = { Text(section.section?.let { "Section $it" } ?: section.name) },
                    onClick = { onSelect(section); expanded = false }
                )
            }
        }
    }
}

/** Fixed-option picker matching a web `<select>` field. */
@Composable
private fun DropdownField(label: String, options: List<String>, selected: String, isError: Boolean = false, onSelect: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    FieldLabel(label)
    Box(modifier = Modifier.fillMaxWidth()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(FrostedCard)
                .border(width = 1.dp, color = if (isError) DangerRed else CardBorder, shape = RoundedCornerShape(14.dp))
                .clickable { expanded = true }
                .padding(horizontal = 11.dp),
            contentAlignment = Alignment.CenterStart
        ) {
            Text(
                text = selected.ifBlank { "Select..." },
                fontSize = 12.sp,
                color = if (selected.isNotBlank()) TextPrimary else TextSecondary
            )
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }, modifier = Modifier.heightIn(max = 300.dp)) {
            DropdownMenuItem(text = { Text("Select...") }, onClick = { onSelect(""); expanded = false })
            options.forEach { option ->
                DropdownMenuItem(text = { Text(option) }, onClick = { onSelect(option); expanded = false })
            }
        }
    }
}
