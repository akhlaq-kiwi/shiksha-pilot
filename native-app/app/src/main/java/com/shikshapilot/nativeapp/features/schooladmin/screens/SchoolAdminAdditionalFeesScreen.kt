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
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.ReceiptLong
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.shikshapilot.nativeapp.data.remote.AdditionalFeeTypeItemDto
import com.shikshapilot.nativeapp.data.remote.CreateAdditionalFeeTypeRequestDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
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

/**
 * Backend: GET/POST/DELETE api/school/additional-fees/types{,/{id}} (SchoolAdminController::
 * getAdditionalFeeTypes/createAdditionalFeeType/deleteAdditionalFeeType). Matches web
 * FinanceManagementPage.jsx's additional-fee tab, but only the apply_type='school' path (applies a
 * flat amount to every active student) — the web's per-class custom-amount mode ('classes'
 * apply_type + `class_amounts`) is not implemented here.
 */
@Composable
fun SchoolAdminAdditionalFeesScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onAvatarClick: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val currencyFormatter = remember { NumberFormat.getCurrencyInstance(Locale("en", "IN")) }

    var feeTypesList by remember { mutableStateOf<List<AdditionalFeeTypeItemDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableStateOf(0) }

    var showFormDialog by remember { mutableStateOf(false) }
    var nameInput by remember { mutableStateOf("") }
    var amountInput by remember { mutableStateOf("") }
    var dueDateInput by remember { mutableStateOf("") }
    var formError by remember { mutableStateOf<String?>(null) }
    var isSaving by remember { mutableStateOf(false) }
    var menuForId by remember { mutableStateOf<Int?>(null) }
    var deleteTarget by remember { mutableStateOf<AdditionalFeeTypeItemDto?>(null) }
    var isDeleting by remember { mutableStateOf(false) }

    LaunchedEffect(refreshKey) {
        isLoading = true
        errorMessage = null
        try {
            val response = RetrofitClient.apiService.getAdditionalFeeTypes()
            if (response.isSuccessful && response.body() != null) {
                feeTypesList = response.body()!!.data
            } else {
                errorMessage = "Unable to load additional fees (code ${response.code()})"
            }
        } catch (e: Exception) {
            errorMessage = e.message ?: "Network error while loading additional fees"
        } finally {
            isLoading = false
        }
    }

    fun resetForm() {
        showFormDialog = false
        nameInput = ""
        amountInput = ""
        dueDateInput = ""
        formError = null
    }

    fun saveFeeType() {
        val amount = amountInput.toDoubleOrNull()
        if (nameInput.trim().length < 3) {
            formError = "Fee description must be at least 3 characters."
            return
        }
        if (amount == null || amount <= 0) {
            formError = "Enter a valid amount greater than 0."
            return
        }
        if (dueDateInput.isBlank()) {
            formError = "Due date is required."
            return
        }
        isSaving = true
        formError = null
        scope.launch {
            try {
                val response = RetrofitClient.apiService.createAdditionalFeeType(
                    CreateAdditionalFeeTypeRequestDto(
                        name = nameInput.trim(),
                        amount = amount,
                        due_date = dueDateInput,
                        apply_type = "school"
                    )
                )
                if (response.isSuccessful) {
                    Toast.makeText(context, "Additional fee applied to all active students", Toast.LENGTH_SHORT).show()
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

    fun confirmDelete(item: AdditionalFeeTypeItemDto) {
        isDeleting = true
        scope.launch {
            try {
                val response = RetrofitClient.apiService.deleteAdditionalFeeType(item.id)
                if (response.isSuccessful) {
                    Toast.makeText(context, "Fee type deleted", Toast.LENGTH_SHORT).show()
                    deleteTarget = null
                    refreshKey++
                } else {
                    Toast.makeText(context, "Cannot delete — payments may already exist for this fee.", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, e.message ?: "Network error", Toast.LENGTH_SHORT).show()
            } finally {
                isDeleting = false
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
                Text(text = "+", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Color.White)
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
                                text = "Additional Fees",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "${feeTypesList.size} fee type(s)",
                                fontSize = 11.5.sp,
                                color = SunsetOrange
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
                        feeTypesList.isEmpty() -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = "No additional fees yet. Tap + to apply one.", color = TextSecondary, fontSize = 13.sp)
                            }
                        }
                        else -> {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                                modifier = Modifier.fillMaxSize()
                            ) {
                                items(feeTypesList) { item ->
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
                                                    .background(SunsetOrange.copy(alpha = 0.18f))
                                                    .border(width = 1.dp, color = SunsetOrange.copy(alpha = 0.4f), shape = CircleShape),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.ReceiptLong,
                                                    contentDescription = "Fee",
                                                    tint = SunsetOrange,
                                                    modifier = Modifier.size(20.dp)
                                                )
                                            }

                                            Spacer(modifier = Modifier.width(12.dp))

                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(text = item.name, fontSize = 14.5.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                                Spacer(modifier = Modifier.height(2.dp))
                                                Text(
                                                    text = "${currencyFormatter.format(item.amount)} • ${item.assigned_to ?: "For All Classes"}",
                                                    fontSize = 12.sp,
                                                    color = TextSecondary
                                                )
                                                if (!item.due_date.isNullOrBlank()) {
                                                    Text(text = "Due ${item.due_date}", fontSize = 11.sp, color = TextSecondary)
                                                }
                                                Spacer(modifier = Modifier.height(4.dp))
                                                Text(
                                                    text = "Collected ${item.collected_students}/${item.total_students} • ${currencyFormatter.format(item.collected_amount)} of ${currencyFormatter.format(item.total_amount)}",
                                                    fontSize = 11.sp,
                                                    color = OnlineGreen
                                                )
                                            }

                                            Box {
                                                Box(
                                                    modifier = Modifier
                                                        .size(32.dp)
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
                                                        text = { Text("Delete") },
                                                        leadingIcon = { Icon(Icons.Default.Delete, contentDescription = null) },
                                                        onClick = {
                                                            menuForId = null
                                                            deleteTarget = item
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
                        text = "Apply Additional Fee",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Applies to every active student this academic year.",
                        fontSize = 11.5.sp,
                        color = TextSecondary
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    OutlinedTextField(
                        value = nameInput,
                        onValueChange = { nameInput = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Fee Name (e.g. Annual Sports Day)") },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = FrostedCard,
                            unfocusedContainerColor = FrostedCard,
                            focusedBorderColor = SunsetOrange,
                            unfocusedBorderColor = CardBorder,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedTextField(
                        value = amountInput,
                        onValueChange = { amountInput = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Amount per student") },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = FrostedCard,
                            unfocusedContainerColor = FrostedCard,
                            focusedBorderColor = SunsetOrange,
                            unfocusedBorderColor = CardBorder,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedTextField(
                        value = dueDateInput,
                        onValueChange = { dueDateInput = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Due Date (YYYY-MM-DD)") },
                        singleLine = true,
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
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(text = formError ?: "", fontSize = 11.5.sp, color = Color(0xFFEF4444))
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
                            onClick = { saveFeeType() },
                            enabled = !isSaving,
                            colors = ButtonDefaults.buttonColors(containerColor = SunsetOrange)
                        ) {
                            if (isSaving) {
                                ThreeDotsLoader(dotSize = 6.dp, dotColor = Color.White, spaceBetween = 4.dp, travelDistance = 4.dp)
                            } else {
                                Text("Apply Fee", fontWeight = FontWeight.Bold)
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
            title = { Text("Delete \"${deleteTarget?.name}\"?") },
            text = { Text("This will remove the fee type. Fees with existing payments cannot be deleted.") },
            confirmButton = {
                TextButton(
                    onClick = { deleteTarget?.let { confirmDelete(it) } },
                    enabled = !isDeleting
                ) {
                    Text(if (isDeleting) "Deleting..." else "Delete", color = Color(0xFFEF4444))
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
