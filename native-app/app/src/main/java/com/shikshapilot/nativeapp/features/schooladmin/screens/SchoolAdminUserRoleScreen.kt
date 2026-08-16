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
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shikshapilot.nativeapp.data.remote.AssignableTeacherDto
import com.shikshapilot.nativeapp.data.remote.ClassTeacherAssignmentItemDto
import com.shikshapilot.nativeapp.data.remote.ClassTeacherAssignmentPairDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.SaveClassTeacherAssignmentsRequestDto
import com.shikshapilot.nativeapp.data.remote.SaveMenuPermissionsRequestDto
import com.shikshapilot.nativeapp.data.remote.TEACHER_MENU_OPTIONS
import com.shikshapilot.nativeapp.data.remote.TeacherPermissionItemDto
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
 * "Assign User Role" — matches the bottom section of the web's Audits & Settings page exactly
 * (verified live against the running web app): Teacher Menu Permissions (per-teacher toggle of
 * which portal menus they can see) + Class Teacher Assignment (one teacher per class/section,
 * enforced unique by the backend).
 */
@Composable
fun SchoolAdminUserRoleScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {}
) {
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
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 13.dp, vertical = 10.dp),
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
                        Icon(imageVector = Icons.Default.ArrowBackIos, contentDescription = "Back", tint = TextPrimary, modifier = Modifier.size(20.dp))
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(text = "Assign User Role", fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                        Text(text = "Configure teacher menu permissions and assign class teachers.", fontSize = 9.5.sp, color = TextSecondary)
                    }
                }

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp)
                ) {
                    TeacherMenuPermissionsSection()
                    Spacer(modifier = Modifier.height(20.dp))
                    ClassTeacherAssignmentSection()
                    Spacer(modifier = Modifier.height(19.dp))
                }
            }
        }
    }
}

@Composable
private fun TeacherMenuPermissionsSection() {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var teachers by remember { mutableStateOf<List<TeacherPermissionItemDto>>(emptyList()) }
    var selectedTeacher by remember { mutableStateOf<TeacherPermissionItemDto?>(null) }
    var selectedMenus by remember { mutableStateOf<Set<String>>(emptySet()) }
    var isLoading by remember { mutableStateOf(true) }
    var isSaving by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        try {
            val response = RetrofitClient.apiService.getMenuPermissions()
            if (response.isSuccessful) {
                teachers = response.body()?.data?.teachers ?: emptyList()
            }
        } catch (_: Exception) {
        } finally {
            isLoading = false
        }
    }

    fun selectTeacher(teacher: TeacherPermissionItemDto) {
        selectedTeacher = teacher
        selectedMenus = teacher.menus.toSet()
    }

    fun toggleMenu(menu: String) {
        selectedMenus = if (selectedMenus.contains(menu)) selectedMenus - menu else selectedMenus + menu
    }

    fun save() {
        val teacher = selectedTeacher ?: return
        isSaving = true
        scope.launch {
            try {
                val response = RetrofitClient.apiService.saveMenuPermissions(
                    SaveMenuPermissionsRequestDto(teacher_id = teacher.id, menus = selectedMenus.toList())
                )
                if (response.isSuccessful) {
                    Toast.makeText(context, "Menu permissions updated", Toast.LENGTH_SHORT).show()
                    teachers = teachers.map { if (it.id == teacher.id) it.copy(menus = selectedMenus.toList()) else it }
                    selectedTeacher = teachers.firstOrNull { it.id == teacher.id }
                } else {
                    Toast.makeText(context, "Failed to save permissions (code ${response.code()})", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, e.message ?: "Network error", Toast.LENGTH_SHORT).show()
            } finally {
                isSaving = false
            }
        }
    }

    SectionHeader("Teacher Menu Permissions")
    Text(text = "Choose an active teacher to assign their School Admin Portal permissions.", fontSize = 10.sp, color = TextSecondary)
    Spacer(modifier = Modifier.height(8.dp))

    TeacherPicker(teachers, selectedTeacher) { selectTeacher(it) }
    Spacer(modifier = Modifier.height(11.dp))

    if (isLoading) {
        ThreeDotsLoader(dotSize = 6.dp, dotColor = SunsetOrange, spaceBetween = 4.dp, travelDistance = 4.dp)
    } else if (selectedTeacher == null) {
        Text(text = "Please select a teacher to configure menu permissions.", fontSize = 10.5.sp, color = TextSecondary)
    } else {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            TEACHER_MENU_OPTIONS.chunked(2).forEach { rowMenus ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    rowMenus.forEach { menu -> MenuToggleChip(menu, selectedMenus.contains(menu), Modifier.weight(1f)) { toggleMenu(menu) } }
                    if (rowMenus.size == 1) Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
        Spacer(modifier = Modifier.height(14.dp))
        Button(
            onClick = { save() },
            enabled = !isSaving,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = SunsetOrange)
        ) {
            if (isSaving) {
                ThreeDotsLoader(dotSize = 6.dp, dotColor = androidx.compose.ui.graphics.Color.White, spaceBetween = 4.dp, travelDistance = 4.dp)
            } else {
                Text("Save Permissions", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun MenuToggleChip(menu: String, isChecked: Boolean, modifier: Modifier = Modifier, onToggle: () -> Unit) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(if (isChecked) SunsetOrange.copy(alpha = 0.12f) else FrostedCard)
            .border(width = 1.dp, color = if (isChecked) SunsetOrange else CardBorder, shape = RoundedCornerShape(10.dp))
            .clickable { onToggle() }
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(16.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(if (isChecked) SunsetOrange else FrostedCard)
                .border(width = 1.dp, color = if (isChecked) SunsetOrange else CardBorder, shape = RoundedCornerShape(4.dp)),
            contentAlignment = Alignment.Center
        ) {
            if (isChecked) {
                Icon(imageVector = Icons.Default.Check, contentDescription = null, tint = androidx.compose.ui.graphics.Color.White, modifier = Modifier.size(11.dp))
            }
        }
        Spacer(modifier = Modifier.width(6.dp))
        Text(text = menu, fontSize = 10.5.sp, fontWeight = FontWeight.SemiBold, color = if (isChecked) SunsetOrange else TextPrimary)
    }
}

@Composable
private fun ClassTeacherAssignmentSection() {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var classes by remember { mutableStateOf<List<ClassTeacherAssignmentItemDto>>(emptyList()) }
    var teachers by remember { mutableStateOf<List<AssignableTeacherDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var savingClassId by remember { mutableStateOf<Int?>(null) }

    suspend fun reload() {
        try {
            val response = RetrofitClient.apiService.getClassTeacherAssignments()
            if (response.isSuccessful) {
                classes = response.body()?.data?.classes ?: emptyList()
                teachers = response.body()?.data?.teachers ?: emptyList()
            }
        } catch (_: Exception) {
        }
    }

    LaunchedEffect(Unit) {
        isLoading = true
        reload()
        isLoading = false
    }

    fun assign(cls: ClassTeacherAssignmentItemDto, teacher: AssignableTeacherDto?) {
        savingClassId = cls.id
        scope.launch {
            try {
                val assignments = classes.mapNotNull { c ->
                    val teacherId = if (c.id == cls.id) teacher?.id else c.assigned_teacher_id
                    teacherId?.let { ClassTeacherAssignmentPairDto(class_id = c.id, teacher_id = it) }
                }
                val response = RetrofitClient.apiService.saveClassTeacherAssignments(
                    SaveClassTeacherAssignmentsRequestDto(assignments = assignments)
                )
                if (response.isSuccessful) {
                    Toast.makeText(context, "Class teacher assignments saved", Toast.LENGTH_SHORT).show()
                    reload()
                } else {
                    Toast.makeText(context, "Failed to save (code ${response.code()}) — teacher may already be assigned elsewhere", Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, e.message ?: "Network error", Toast.LENGTH_SHORT).show()
            } finally {
                savingClassId = null
            }
        }
    }

    SectionHeader("Class Teacher Assignment")
    if (isLoading) {
        ThreeDotsLoader(dotSize = 6.dp, dotColor = SunsetOrange, spaceBetween = 4.dp, travelDistance = 4.dp)
    } else {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            classes.forEach { cls ->
                ClassAssignmentRow(
                    cls = cls,
                    teachers = teachers,
                    isSaving = savingClassId == cls.id,
                    onAssign = { assign(cls, it) }
                )
            }
        }
    }
}

@Composable
private fun ClassAssignmentRow(
    cls: ClassTeacherAssignmentItemDto,
    teachers: List<AssignableTeacherDto>,
    isSaving: Boolean,
    onAssign: (AssignableTeacherDto?) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(FrostedCard)
            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(14.dp))
            .padding(12.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "${cls.name}${cls.section?.let { "-$it" } ?: ""}",
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
            }
            Box {
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(DarkCanvas)
                        .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(10.dp))
                        .clickable(enabled = !isSaving) { expanded = true }
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (isSaving) {
                        ThreeDotsLoader(dotSize = 4.dp, dotColor = SunsetOrange, spaceBetween = 3.dp, travelDistance = 3.dp)
                    } else {
                        Text(
                            text = cls.assigned_teacher_name ?: "-- Unassigned --",
                            fontSize = 11.sp,
                            color = if (cls.assigned_teacher_name != null) TextPrimary else TextSecondary
                        )
                    }
                }
                DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }, modifier = Modifier.heightIn(max = 300.dp)) {
                    DropdownMenuItem(text = { Text("-- Unassigned --") }, onClick = { onAssign(null); expanded = false })
                    teachers.forEach { teacher ->
                        DropdownMenuItem(
                            text = { Text("${teacher.name}${teacher.department?.let { " ($it)" } ?: ""}") },
                            onClick = { onAssign(teacher); expanded = false }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TeacherPicker(teachers: List<TeacherPermissionItemDto>, selected: TeacherPermissionItemDto?, onSelect: (TeacherPermissionItemDto) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box(modifier = Modifier.fillMaxWidth()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(FrostedCard)
                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(14.dp))
                .clickable { expanded = true }
                .padding(horizontal = 11.dp),
            contentAlignment = Alignment.CenterStart
        ) {
            Text(
                text = selected?.let { "${it.name}${it.department?.let { d -> " ($d)" } ?: ""}" } ?: "-- Choose Teacher --",
                fontSize = 12.sp,
                color = if (selected != null) TextPrimary else TextSecondary
            )
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }, modifier = Modifier.heightIn(max = 300.dp)) {
            teachers.forEach { teacher ->
                DropdownMenuItem(
                    text = { Text("${teacher.name}${teacher.department?.let { d -> " ($d)" } ?: ""}") },
                    onClick = { onSelect(teacher); expanded = false }
                )
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(text = title.uppercase(), fontSize = 9.5.sp, fontWeight = FontWeight.ExtraBold, color = SunsetOrange, letterSpacing = 1.sp)
    Spacer(modifier = Modifier.height(8.dp))
}
