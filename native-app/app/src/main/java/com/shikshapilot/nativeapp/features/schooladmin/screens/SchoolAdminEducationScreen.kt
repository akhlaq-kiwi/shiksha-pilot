package com.shikshapilot.nativeapp.features.schooladmin.screens

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
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material.icons.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Class
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.EventSeat
import androidx.compose.material.icons.filled.School
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.theme.CardBorder
import com.shikshapilot.nativeapp.ui.theme.DarkCanvas
import com.shikshapilot.nativeapp.ui.theme.FrostedCard
import com.shikshapilot.nativeapp.ui.theme.InfoBlue
import com.shikshapilot.nativeapp.ui.theme.SunsetOrange
import com.shikshapilot.nativeapp.ui.theme.TextPrimary
import com.shikshapilot.nativeapp.ui.theme.TextSecondary
import com.shikshapilot.nativeapp.ui.theme.WarningYellow

private data class EducationModule(
    val id: String,
    val title: String,
    val subtitle: String,
    val icon: ImageVector,
    val iconColor: Color
)

/**
 * Dedicated "Education" landing page for the bottom-nav tab (was previously a bottom-sheet
 * menu drawer). Groups Classes & Sections, Timetable, Examinations, Attendance & Leaderboard
 * and Academic Setup as a real, navigable page.
 */
@Composable
fun SchoolAdminEducationScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {}
) {
    val modules = listOf(
        EducationModule(
            id = "classes",
            title = "Classes & Sections",
            subtitle = "Manage classes, sections & subject mapping",
            icon = Icons.Default.Class,
            iconColor = InfoBlue
        ),
        EducationModule(
            id = "timetable",
            title = "Timetable",
            subtitle = "Build, view & publish the class timetable",
            icon = Icons.Default.CalendarMonth,
            iconColor = SunsetOrange
        ),
        EducationModule(
            id = "exams",
            title = "Examinations",
            subtitle = "Create, manage & publish examinations",
            icon = Icons.Default.Assignment,
            iconColor = InfoBlue
        ),
        EducationModule(
            id = "seating_plan",
            title = "Seating Plan",
            subtitle = "Configure rooms & generate exam seating",
            icon = Icons.Default.EventSeat,
            iconColor = InfoBlue
        ),
        EducationModule(
            id = "attendance",
            title = "Attendance & Leaderboard",
            subtitle = "Daily marking, missing class exceptions & leaderboard",
            icon = Icons.Default.DateRange,
            iconColor = WarningYellow
        ),
        EducationModule(
            id = "academic_setup",
            title = "Academic Setup",
            subtitle = "Academic years, subjects & grading configuration",
            icon = Icons.Default.School,
            iconColor = WarningYellow
        )
    )

    Scaffold(containerColor = DarkCanvas) { paddingValues ->
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
                                text = "Education",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "Academics & Timetable",
                                fontSize = 11.5.sp,
                                color = SunsetOrange
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxSize()) {
                        items(modules) { module ->
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(18.dp))
                                    .background(FrostedCard)
                                    .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(18.dp))
                                    .clickable { onNavigate(module.id) }
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
                                            .background(module.iconColor.copy(alpha = 0.18f))
                                            .border(width = 1.dp, color = module.iconColor.copy(alpha = 0.4f), shape = CircleShape),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = module.icon,
                                            contentDescription = module.title,
                                            tint = module.iconColor,
                                            modifier = Modifier.size(20.dp)
                                        )
                                    }

                                    Spacer(modifier = Modifier.width(12.dp))

                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = module.title,
                                            fontSize = 15.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = TextPrimary
                                        )
                                        Text(
                                            text = module.subtitle,
                                            fontSize = 12.sp,
                                            color = TextSecondary
                                        )
                                    }

                                    Icon(
                                        imageVector = Icons.Default.ArrowForwardIos,
                                        contentDescription = null,
                                        tint = TextSecondary,
                                        modifier = Modifier.size(14.dp)
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
