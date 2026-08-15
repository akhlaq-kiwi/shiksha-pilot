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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shikshapilot.nativeapp.data.remote.CreateFeeStructureRequestDto
import com.shikshapilot.nativeapp.data.remote.FeeStructureDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
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
 * Backend: GET/POST api/school/fee-structures (SchoolAdminController::getFeeStructures /
 * createFeeStructure -> SchoolAdminService). Class-level monthly configuration
 * (api/school/class-fee-configurations) is a more complex per-month master-catalog resolution
 * flow (see SchoolAdminService::saveClassFeeConfiguration) — out of scope for this simple
 * create/list screen, which covers the base `fee_structures` table (name/amount/frequency/class).
 */
@Composable
fun SchoolAdminFeeStructureScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScopeCompat()

    var structures by remember { mutableStateOf<List<FeeStructureDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableStateOf(0) }

    var showCreateForm by remember { mutableStateOf(false) }
    var nameInput by remember { mutableStateOf("") }
    var amountInput by remember { mutableStateOf("") }
    var frequencyInput by remember { mutableStateOf("Monthly") }
    var classIdInput by remember { mutableStateOf("") }
    var isSaving by remember { mutableStateOf(false) }

    LaunchedEffect(reloadKey) {
        isLoading = true
        errorMessage = null
        try {
            val response = RetrofitClient.apiService.getFeeStructures()
            if (response.isSuccessful && response.body() != null) {
                structures = response.body()!!.data
            } else {
                errorMessage = "Unable to load fee structures (code ${response.code()})"
            }
        } catch (e: Exception) {
            errorMessage = e.message ?: "Network error while loading fee structures"
        } finally {
            isLoading = false
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
                                text = "Fee Structures",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "${structures.size} structures • QA Live API",
                                fontSize = 11.5.sp,
                                color = SunsetOrange
                            )
                        }

                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(SunsetOrange)
                                .clickable { showCreateForm = !showCreateForm },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Add,
                                contentDescription = "Add",
                                tint = androidx.compose.ui.graphics.Color.White,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    if (showCreateForm) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(16.dp))
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
                                .padding(14.dp)
                        ) {
                            Column {
                                Text(text = "New Fee Structure", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = nameInput,
                                    onValueChange = { nameInput = it },
                                    label = { Text("Name (e.g. Tuition Fee)") },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = OutlinedTextFieldDefaults.colors(focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = amountInput,
                                    onValueChange = { amountInput = it },
                                    label = { Text("Amount") },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = OutlinedTextFieldDefaults.colors(focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = frequencyInput,
                                    onValueChange = { frequencyInput = it },
                                    label = { Text("Frequency (Monthly/Quarterly/Half-Yearly/Yearly/One-Time)") },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = OutlinedTextFieldDefaults.colors(focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = classIdInput,
                                    onValueChange = { classIdInput = it },
                                    label = { Text("Class ID (optional)") },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = OutlinedTextFieldDefaults.colors(focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                                )
                                Spacer(modifier = Modifier.height(10.dp))
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(if (isSaving) SunsetOrange.copy(alpha = 0.5f) else SunsetOrange)
                                        .clickable(enabled = !isSaving) {
                                            val amount = amountInput.toDoubleOrNull()
                                            if (nameInput.isBlank() || amount == null) {
                                                Toast.makeText(context, "Name and a valid amount are required", Toast.LENGTH_SHORT).show()
                                                return@clickable
                                            }
                                            isSaving = true
                                            scope.launch {
                                                try {
                                                    val res = RetrofitClient.apiService.createFeeStructure(
                                                        CreateFeeStructureRequestDto(
                                                            name = nameInput,
                                                            amount = amount,
                                                            frequency = frequencyInput.ifBlank { "Monthly" },
                                                            class_id = classIdInput.toIntOrNull()
                                                        )
                                                    )
                                                    if (res.isSuccessful) {
                                                        Toast.makeText(context, "Fee structure created", Toast.LENGTH_SHORT).show()
                                                        nameInput = ""; amountInput = ""; classIdInput = ""
                                                        showCreateForm = false
                                                        reloadKey++
                                                    } else {
                                                        Toast.makeText(context, "Failed (code ${res.code()})", Toast.LENGTH_SHORT).show()
                                                    }
                                                } catch (e: Exception) {
                                                    Toast.makeText(context, e.message ?: "Network error", Toast.LENGTH_SHORT).show()
                                                } finally {
                                                    isSaving = false
                                                }
                                            }
                                        }
                                        .padding(vertical = 10.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(text = if (isSaving) "Saving..." else "Save", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = androidx.compose.ui.graphics.Color.White)
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(14.dp))
                    }

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
                        structures.isEmpty() -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = "No fee structures configured yet.", color = TextSecondary, fontSize = 13.sp)
                            }
                        }
                        else -> {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                                modifier = Modifier.fillMaxSize()
                            ) {
                                items(structures) { fs ->
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
                                                    .size(42.dp)
                                                    .clip(CircleShape)
                                                    .background(OnlineGreen.copy(alpha = 0.18f))
                                                    .border(width = 1.dp, color = OnlineGreen.copy(alpha = 0.4f), shape = CircleShape),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.Receipt,
                                                    contentDescription = "Fee",
                                                    tint = OnlineGreen,
                                                    modifier = Modifier.size(20.dp)
                                                )
                                            }

                                            Spacer(modifier = Modifier.width(12.dp))

                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(text = fs.name, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                                Text(
                                                    text = "${fs.frequency ?: "Monthly"}${fs.class_id?.let { " • Class ID $it" } ?: " • All classes"}",
                                                    fontSize = 12.sp,
                                                    color = TextSecondary
                                                )
                                            }

                                            Text(
                                                text = "₹ ${"%,.0f".format(fs.amount)}",
                                                fontSize = 15.sp,
                                                fontWeight = FontWeight.ExtraBold,
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

@Composable
private fun rememberCoroutineScopeCompat() = androidx.compose.runtime.rememberCoroutineScope()
