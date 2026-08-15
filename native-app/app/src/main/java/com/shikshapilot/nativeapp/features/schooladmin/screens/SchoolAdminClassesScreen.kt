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
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material.icons.filled.Class
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Refresh
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.shikshapilot.nativeapp.common.PredefinedClasses
import com.shikshapilot.nativeapp.data.remote.ClassDto
import com.shikshapilot.nativeapp.data.remote.CreateClassRequestDto
import com.shikshapilot.nativeapp.data.remote.DeleteClassRequestDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.UpdateClassRequestDto
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.components.ThreeDotsLoader
import com.shikshapilot.nativeapp.ui.theme.CardBorder
import com.shikshapilot.nativeapp.ui.theme.DarkCanvas
import com.shikshapilot.nativeapp.ui.theme.FrostedCard
import com.shikshapilot.nativeapp.ui.theme.InfoBlue
import com.shikshapilot.nativeapp.ui.theme.SunsetOrange
import com.shikshapilot.nativeapp.ui.theme.TextPrimary
import com.shikshapilot.nativeapp.ui.theme.TextSecondary
import kotlinx.coroutines.launch

private val ALPHABET_SECTIONS = listOf("A", "B", "C", "D")
private val COLOR_SECTIONS = listOf("Red", "Blue", "Green", "Yellow")
private const val SECTION_TYPE_NONE = "No Sections"
private const val SECTION_TYPE_ALPHABET = "Alphabet Sections"
private const val SECTION_TYPE_COLOR = "Color Sections"

/**
 * Backend: GET/POST/PUT/DELETE api/school/classes (SchoolAdminController::getClasses/createClass/
 * updateClass/deleteClass). Each row is one class+section combination (`classes` table has no
 * per-class student-count or class-teacher columns), so this list groups rows by class `name` and
 * shows the sections found under it. Create/update/delete match SchoolAdminService's name+sections
 * "master catalog" contract used by the web ClassesPage.
 */
@Composable
fun SchoolAdminClassesScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {},
    onViewStudents: (String) -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var classes by remember { mutableStateOf<List<ClassDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableStateOf(0) }

    var showFormDialog by remember { mutableStateOf(false) }
    var isEditing by remember { mutableStateOf(false) }
    var editOldClassName by remember { mutableStateOf("") }
    var classNameInput by remember { mutableStateOf("") }
    var selectedClassNames by remember { mutableStateOf<List<String>>(emptyList()) }
    var sectionTypeInput by remember { mutableStateOf(SECTION_TYPE_NONE) }
    var selectedSections by remember { mutableStateOf<List<String>>(emptyList()) }
    var formError by remember { mutableStateOf<String?>(null) }
    var isSaving by remember { mutableStateOf(false) }

    var menuForClass by remember { mutableStateOf<String?>(null) }
    var deleteTarget by remember { mutableStateOf<String?>(null) }
    var isDeleting by remember { mutableStateOf(false) }
    var deleteError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(reloadKey) {
        isLoading = true
        errorMessage = null
        try {
            val response = RetrofitClient.apiService.getClasses()
            if (response.isSuccessful && response.body() != null) {
                classes = response.body()!!.data
            } else {
                errorMessage = "Unable to load classes (code ${response.code()})"
            }
        } catch (e: Exception) {
            errorMessage = e.message ?: "Network error while loading classes"
        } finally {
            isLoading = false
        }
    }

    val grouped = remember(classes) {
        classes.groupBy { it.name }.toSortedMap()
    }

    val availablePredefinedClasses = remember(classes) {
        val addedLower = classes.map { it.name.trim().lowercase() }.toSet()
        PredefinedClasses.NAMES.filter { it.lowercase() !in addedLower }
    }

    fun resetForm() {
        showFormDialog = false
        isEditing = false
        editOldClassName = ""
        classNameInput = ""
        selectedClassNames = emptyList()
        sectionTypeInput = SECTION_TYPE_NONE
        selectedSections = emptyList()
        formError = null
    }

    fun openAddDialog() {
        resetForm()
        showFormDialog = true
    }

    fun openEditDialog(className: String, sections: List<String>) {
        isEditing = true
        editOldClassName = className
        classNameInput = className
        sectionTypeInput = when {
            sections.isEmpty() -> SECTION_TYPE_NONE
            sections.all { it in ALPHABET_SECTIONS } -> SECTION_TYPE_ALPHABET
            sections.all { it in COLOR_SECTIONS } -> SECTION_TYPE_COLOR
            else -> SECTION_TYPE_ALPHABET
        }
        selectedSections = sections
        formError = null
        showFormDialog = true
    }

    fun saveClass() {
        if (selectedSections.size > 4) {
            formError = "Maximum 4 sections allowed."
            return
        }
        if (isEditing) {
            val name = classNameInput.trim()
            if (name.isEmpty()) {
                formError = "Class name is required."
                return
            }
            isSaving = true
            formError = null
            scope.launch {
                try {
                    val response = RetrofitClient.apiService.updateClass(
                        UpdateClassRequestDto(oldName = editOldClassName, name = name, sections = selectedSections)
                    )
                    if (response.isSuccessful) {
                        Toast.makeText(context, "Class updated", Toast.LENGTH_SHORT).show()
                        resetForm()
                        reloadKey++
                    } else {
                        formError = "Failed to save class (code ${response.code()})"
                    }
                } catch (e: Exception) {
                    formError = e.message ?: "Network error while saving class"
                } finally {
                    isSaving = false
                }
            }
            return
        }

        if (selectedClassNames.isEmpty()) {
            formError = "Please select at least one class."
            return
        }
        isSaving = true
        formError = null
        scope.launch {
            try {
                val failed = mutableListOf<String>()
                for (name in selectedClassNames) {
                    val response = RetrofitClient.apiService.createClass(
                        CreateClassRequestDto(name = name, sections = selectedSections)
                    )
                    if (!response.isSuccessful) failed.add(name)
                }
                if (failed.isEmpty()) {
                    val label = if (selectedClassNames.size == 1) "Class created" else "${selectedClassNames.size} classes created"
                    Toast.makeText(context, label, Toast.LENGTH_SHORT).show()
                    resetForm()
                    reloadKey++
                } else {
                    formError = "Failed to create: ${failed.joinToString(", ")}"
                    reloadKey++
                }
            } catch (e: Exception) {
                formError = e.message ?: "Network error while saving class"
            } finally {
                isSaving = false
            }
        }
    }

    fun confirmDelete(className: String) {
        isDeleting = true
        deleteError = null
        scope.launch {
            try {
                val response = RetrofitClient.apiService.deleteClass(DeleteClassRequestDto(name = className))
                if (response.isSuccessful) {
                    Toast.makeText(context, "Class deleted", Toast.LENGTH_SHORT).show()
                    deleteTarget = null
                    reloadKey++
                } else {
                    deleteError = "This class may still have students enrolled. Transfer or remove them before deleting."
                }
            } catch (e: Exception) {
                deleteError = e.message ?: "Network error while deleting class"
            } finally {
                isDeleting = false
            }
        }
    }

    Scaffold(
        containerColor = DarkCanvas,
        floatingActionButton = {
            FloatingActionButton(
                onClick = { openAddDialog() },
                containerColor = SunsetOrange
            ) {
                Text(text = "+", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = androidx.compose.ui.graphics.Color.White)
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(DarkCanvas)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                StickyTopBar(
                    schoolName = schoolName,
                    unreadNotificationCount = 2,
                    onNotificationClick = {},
                    onAvatarClick = {}
                )

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp, vertical = 12.dp)
                ) {
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
                                text = "Classes & Sections",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "${grouped.size} Classes • ${classes.size} Sections",
                                fontSize = 11.5.sp,
                                color = SunsetOrange
                            )
                        }

                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = CircleShape)
                                .clickable { reloadKey++ },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Refresh,
                                contentDescription = "Refresh",
                                tint = SunsetOrange,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    when {
                        isLoading -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                ThreeDotsLoader(dotSize = 10.dp, dotColor = SunsetOrange, spaceBetween = 8.dp, travelDistance = 8.dp)
                            }
                        }
                        errorMessage != null -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = errorMessage ?: "Something went wrong", color = TextSecondary, fontSize = 13.sp)
                            }
                        }
                        grouped.isEmpty() -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = "No classes registered. Tap + to add one.", color = TextSecondary, fontSize = 13.sp)
                            }
                        }
                        else -> {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                                modifier = Modifier.fillMaxSize()
                            ) {
                                items(grouped.entries.toList()) { (className, rows) ->
                                    val sections = rows.mapNotNull { it.section }.sorted()
                                    val academicYearName = rows.firstOrNull()?.academic_year_name

                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(18.dp))
                                            .background(FrostedCard)
                                            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(18.dp))
                                            .clickable { onViewStudents(className) }
                                            .padding(14.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .size(42.dp)
                                                    .clip(CircleShape)
                                                    .background(InfoBlue.copy(alpha = 0.18f))
                                                    .border(width = 1.dp, color = InfoBlue.copy(alpha = 0.4f), shape = CircleShape),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.Class,
                                                    contentDescription = "Class",
                                                    tint = InfoBlue,
                                                    modifier = Modifier.size(20.dp)
                                                )
                                            }

                                            Spacer(modifier = Modifier.width(12.dp))

                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(
                                                    text = className,
                                                    fontSize = 15.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = TextPrimary
                                                )
                                                Spacer(modifier = Modifier.height(2.dp))
                                                Text(
                                                    text = if (sections.isNotEmpty()) "Sections: ${sections.joinToString(", ")}" else "No sections",
                                                    fontSize = 12.sp,
                                                    color = TextSecondary
                                                )
                                                if (!academicYearName.isNullOrBlank()) {
                                                    Text(
                                                        text = "Academic Year: $academicYearName",
                                                        fontSize = 11.sp,
                                                        color = TextSecondary
                                                    )
                                                }
                                            }

                                            Box {
                                                Box(
                                                    modifier = Modifier
                                                        .size(32.dp)
                                                        .clip(CircleShape)
                                                        .clickable { menuForClass = className },
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
                                                    expanded = menuForClass == className,
                                                    onDismissRequest = { menuForClass = null }
                                                ) {
                                                    DropdownMenuItem(
                                                        text = { Text("View Students") },
                                                        leadingIcon = { Icon(Icons.Default.Class, contentDescription = null) },
                                                        onClick = {
                                                            menuForClass = null
                                                            onViewStudents(className)
                                                        }
                                                    )
                                                    DropdownMenuItem(
                                                        text = { Text("Manage Sections") },
                                                        leadingIcon = { Icon(Icons.Default.Edit, contentDescription = null) },
                                                        onClick = {
                                                            menuForClass = null
                                                            openEditDialog(className, sections)
                                                        }
                                                    )
                                                    DropdownMenuItem(
                                                        text = { Text("Delete Class") },
                                                        leadingIcon = { Icon(Icons.Default.Delete, contentDescription = null) },
                                                        onClick = {
                                                            menuForClass = null
                                                            deleteError = null
                                                            deleteTarget = className
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
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (isEditing) "Manage Class Sections" else "Add Class",
                            fontSize = 16.sp,
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

                    Spacer(modifier = Modifier.height(16.dp))

                    if (isEditing) {
                        Text(text = "Class Name", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextSecondary)
                        Spacer(modifier = Modifier.height(6.dp))
                        OutlinedTextField(
                            value = classNameInput,
                            onValueChange = {},
                            enabled = false,
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            shape = RoundedCornerShape(14.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                disabledContainerColor = FrostedCard,
                                unfocusedBorderColor = CardBorder,
                                disabledTextColor = TextPrimary
                            )
                        )
                    } else {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(text = "Select Class(es)", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextSecondary)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                if (selectedClassNames.isNotEmpty()) {
                                    Text(
                                        text = "${selectedClassNames.size} Selected",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = SunsetOrange,
                                        modifier = Modifier.padding(end = 10.dp)
                                    )
                                }
                                if (availablePredefinedClasses.isNotEmpty()) {
                                    Text(
                                        text = if (selectedClassNames.size == availablePredefinedClasses.size) "Deselect All" else "Select All",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = InfoBlue,
                                        modifier = Modifier.clickable {
                                            selectedClassNames = if (selectedClassNames.size == availablePredefinedClasses.size) {
                                                emptyList()
                                            } else {
                                                availablePredefinedClasses
                                            }
                                            formError = null
                                        }
                                    )
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))

                        if (availablePredefinedClasses.isEmpty()) {
                            Text(
                                text = "All standard classes have been added.",
                                fontSize = 12.sp,
                                color = TextSecondary,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 12.dp)
                            )
                        } else {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .heightIn(max = 220.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(FrostedCard)
                                    .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(14.dp))
                                    .verticalScroll(rememberScrollState())
                                    .padding(6.dp),
                                verticalArrangement = Arrangement.spacedBy(2.dp)
                            ) {
                                availablePredefinedClasses.forEach { name ->
                                    val isSelected = selectedClassNames.contains(name)
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(if (isSelected) SunsetOrange.copy(alpha = 0.18f) else androidx.compose.ui.graphics.Color.Transparent)
                                            .clickable {
                                                selectedClassNames = if (isSelected) {
                                                    selectedClassNames - name
                                                } else {
                                                    selectedClassNames + name
                                                }
                                                formError = null
                                            }
                                            .padding(horizontal = 10.dp, vertical = 10.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = name,
                                            fontSize = 12.5.sp,
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                            color = if (isSelected) SunsetOrange else TextPrimary
                                        )
                                        Box(
                                            modifier = Modifier
                                                .size(18.dp)
                                                .clip(CircleShape)
                                                .background(if (isSelected) SunsetOrange else androidx.compose.ui.graphics.Color.Transparent)
                                                .border(width = 1.dp, color = if (isSelected) SunsetOrange else CardBorder, shape = CircleShape)
                                        )
                                    }
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(text = "Section Type (Optional)", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextSecondary)
                    Spacer(modifier = Modifier.height(6.dp))

                    var sectionTypeExpanded by remember { mutableStateOf(false) }
                    Box(modifier = Modifier.fillMaxWidth()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(14.dp))
                                .clickable { sectionTypeExpanded = true }
                                .padding(horizontal = 14.dp, vertical = 14.dp)
                        ) {
                            Text(text = sectionTypeInput, fontSize = 14.sp, color = TextPrimary)
                        }
                        DropdownMenu(
                            expanded = sectionTypeExpanded,
                            onDismissRequest = { sectionTypeExpanded = false }
                        ) {
                            listOf(SECTION_TYPE_NONE, SECTION_TYPE_ALPHABET, SECTION_TYPE_COLOR).forEach { option ->
                                DropdownMenuItem(
                                    text = { Text(option) },
                                    onClick = {
                                        if (option != sectionTypeInput) {
                                            sectionTypeInput = option
                                            selectedSections = emptyList()
                                        }
                                        sectionTypeExpanded = false
                                    }
                                )
                            }
                        }
                    }

                    if (sectionTypeInput != SECTION_TYPE_NONE) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(text = "Select Sections (Max 4)", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextSecondary)
                        Spacer(modifier = Modifier.height(8.dp))

                        val options = if (sectionTypeInput == SECTION_TYPE_ALPHABET) ALPHABET_SECTIONS else COLOR_SECTIONS
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            options.chunked(2).forEach { rowItems ->
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    rowItems.forEach { sec ->
                                        val isChecked = selectedSections.contains(sec)
                                        Box(
                                            modifier = Modifier
                                                .weight(1f)
                                                .clip(RoundedCornerShape(12.dp))
                                                .background(if (isChecked) SunsetOrange.copy(alpha = 0.18f) else FrostedCard)
                                                .border(
                                                    width = 1.dp,
                                                    color = if (isChecked) SunsetOrange else CardBorder,
                                                    shape = RoundedCornerShape(12.dp)
                                                )
                                                .clickable {
                                                    selectedSections = if (isChecked) {
                                                        selectedSections - sec
                                                    } else if (selectedSections.size < 4) {
                                                        selectedSections + sec
                                                    } else {
                                                        selectedSections
                                                    }
                                                }
                                                .padding(horizontal = 10.dp, vertical = 10.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                text = sec,
                                                fontSize = 12.5.sp,
                                                fontWeight = if (isChecked) FontWeight.Bold else FontWeight.Medium,
                                                color = if (isChecked) SunsetOrange else TextPrimary
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (formError != null) {
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(text = formError ?: "", fontSize = 11.5.sp, color = androidx.compose.ui.graphics.Color(0xFFEF4444))
                    }

                    Spacer(modifier = Modifier.height(18.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End
                    ) {
                        TextButton(onClick = { resetForm() }) {
                            Text("Cancel", color = TextSecondary)
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Button(
                            onClick = { saveClass() },
                            enabled = !isSaving,
                            colors = ButtonDefaults.buttonColors(containerColor = SunsetOrange)
                        ) {
                            if (isSaving) {
                                ThreeDotsLoader(dotSize = 6.dp, dotColor = androidx.compose.ui.graphics.Color.White, spaceBetween = 4.dp, travelDistance = 4.dp)
                            } else {
                                Text("Save", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }

    if (deleteTarget != null) {
        AlertDialog(
            onDismissRequest = { if (!isDeleting) deleteTarget = null },
            title = { Text("Delete Class ${deleteTarget}?") },
            text = {
                Column {
                    Text("This will permanently remove the class and its sections. Classes with enrolled students cannot be deleted.")
                    if (deleteError != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(text = deleteError ?: "", color = androidx.compose.ui.graphics.Color(0xFFEF4444), fontSize = 12.sp)
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = { deleteTarget?.let { confirmDelete(it) } },
                    enabled = !isDeleting
                ) {
                    Text(if (isDeleting) "Deleting..." else "Delete", color = androidx.compose.ui.graphics.Color(0xFFEF4444))
                }
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }, enabled = !isDeleting) {
                    Text("Cancel")
                }
            }
        )
    }
}
