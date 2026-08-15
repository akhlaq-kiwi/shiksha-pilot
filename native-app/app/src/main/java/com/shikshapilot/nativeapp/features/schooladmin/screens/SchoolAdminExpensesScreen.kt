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
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Receipt
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
import com.shikshapilot.nativeapp.data.remote.CreateSchoolExpenseRequestDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.SchoolExpenseItemDto
import com.shikshapilot.nativeapp.data.remote.UpdateSchoolExpenseRequestDto
import com.shikshapilot.nativeapp.ui.components.PullToRefreshWrapper
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.components.ThreeDotsLoader
import com.shikshapilot.nativeapp.ui.theme.CardBorder
import com.shikshapilot.nativeapp.ui.theme.DarkCanvas
import com.shikshapilot.nativeapp.ui.theme.FrostedCard
import com.shikshapilot.nativeapp.ui.theme.SunsetOrange
import com.shikshapilot.nativeapp.ui.theme.TextPrimary
import com.shikshapilot.nativeapp.ui.theme.TextSecondary
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

/**
 * Backend: GET/POST/PUT/DELETE api/school/expenses{,/{id}} (SchoolAdminController::getSchoolExpenses/
 * createSchoolExpense/updateSchoolExpense/deleteSchoolExpense -> school_expenses table). Matches web
 * FinanceManagementPage.jsx's expenses tab. Bill attachment upload is not implemented here (web
 * supports `bill_attachment_path` via file upload) — expenses can be created/edited/deleted without
 * a bill, matching the backend's optional `bill_attachment_path` field.
 */
@Composable
fun SchoolAdminExpensesScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onAvatarClick: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val currencyFormatter = remember { NumberFormat.getCurrencyInstance(Locale("en", "IN")) }

    var expensesList by remember { mutableStateOf<List<SchoolExpenseItemDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableStateOf(0) }

    var showFormDialog by remember { mutableStateOf(false) }
    var isEditing by remember { mutableStateOf(false) }
    var editId by remember { mutableStateOf(0) }
    var descriptionInput by remember { mutableStateOf("") }
    var amountInput by remember { mutableStateOf("") }
    var dateInput by remember { mutableStateOf("") }
    var categoryInput by remember { mutableStateOf("") }
    var paymentMethodInput by remember { mutableStateOf("") }
    var formError by remember { mutableStateOf<String?>(null) }
    var isSaving by remember { mutableStateOf(false) }
    var menuForId by remember { mutableStateOf<Int?>(null) }

    LaunchedEffect(refreshKey) {
        isLoading = true
        errorMessage = null
        try {
            val response = RetrofitClient.apiService.getSchoolExpenses()
            if (response.isSuccessful && response.body() != null) {
                expensesList = response.body()!!.data
            } else {
                errorMessage = "Unable to load expenses (code ${response.code()})"
            }
        } catch (e: Exception) {
            errorMessage = e.message ?: "Network error while loading expenses"
        } finally {
            isLoading = false
        }
    }

    val totalThisList = remember(expensesList) { expensesList.sumOf { it.amount } }

    fun resetForm() {
        showFormDialog = false
        isEditing = false
        editId = 0
        descriptionInput = ""
        amountInput = ""
        dateInput = ""
        categoryInput = ""
        paymentMethodInput = ""
        formError = null
    }

    fun openEditDialog(item: SchoolExpenseItemDto) {
        isEditing = true
        editId = item.id
        descriptionInput = item.description
        amountInput = item.amount.toString()
        dateInput = item.expense_date
        categoryInput = item.category ?: ""
        paymentMethodInput = item.payment_method ?: ""
        formError = null
        showFormDialog = true
    }

    fun saveExpense() {
        val amount = amountInput.toDoubleOrNull()
        if (descriptionInput.trim().length < 3) {
            formError = "Description must be at least 3 characters."
            return
        }
        if (amount == null || amount <= 0) {
            formError = "Enter a valid amount greater than 0."
            return
        }
        if (dateInput.isBlank()) {
            formError = "Expense date is required."
            return
        }
        isSaving = true
        formError = null
        scope.launch {
            try {
                val response = if (isEditing) {
                    RetrofitClient.apiService.updateSchoolExpense(
                        editId,
                        UpdateSchoolExpenseRequestDto(
                            description = descriptionInput.trim(),
                            amount = amount,
                            expense_date = dateInput,
                            category = categoryInput.ifBlank { null },
                            payment_method = paymentMethodInput.ifBlank { null }
                        )
                    )
                } else {
                    RetrofitClient.apiService.createSchoolExpense(
                        CreateSchoolExpenseRequestDto(
                            description = descriptionInput.trim(),
                            amount = amount,
                            expense_date = dateInput,
                            category = categoryInput.ifBlank { null },
                            payment_method = paymentMethodInput.ifBlank { null }
                        )
                    )
                }
                if (response.isSuccessful) {
                    Toast.makeText(context, if (isEditing) "Expense updated" else "Expense recorded", Toast.LENGTH_SHORT).show()
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

    fun deleteExpense(item: SchoolExpenseItemDto) {
        scope.launch {
            try {
                val response = RetrofitClient.apiService.deleteSchoolExpense(item.id)
                if (response.isSuccessful) {
                    Toast.makeText(context, "Expense deleted", Toast.LENGTH_SHORT).show()
                    refreshKey++
                } else {
                    Toast.makeText(context, "Cannot delete — may already be locked in a financial report.", Toast.LENGTH_SHORT).show()
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
                                text = "School Expenses",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "Total: ${currencyFormatter.format(totalThisList)}",
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
                        expensesList.isEmpty() -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = "No expenses recorded. Tap + to add one.", color = TextSecondary, fontSize = 13.sp)
                            }
                        }
                        else -> {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                                modifier = Modifier.fillMaxSize()
                            ) {
                                items(expensesList) { item ->
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
                                                    imageVector = Icons.Default.Receipt,
                                                    contentDescription = "Expense",
                                                    tint = SunsetOrange,
                                                    modifier = Modifier.size(20.dp)
                                                )
                                            }

                                            Spacer(modifier = Modifier.width(12.dp))

                                            Column(modifier = Modifier.weight(1f)) {
                                                Row(verticalAlignment = Alignment.CenterVertically) {
                                                    Text(text = item.description, fontSize = 14.5.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                                    if (item.is_locked) {
                                                        Spacer(modifier = Modifier.width(6.dp))
                                                        Icon(imageVector = Icons.Default.Lock, contentDescription = "Locked", tint = TextSecondary, modifier = Modifier.size(12.dp))
                                                    }
                                                }
                                                Spacer(modifier = Modifier.height(2.dp))
                                                Text(
                                                    text = "${item.category ?: "Other"} • ${item.payment_method ?: "Cash"} • ${item.expense_date}",
                                                    fontSize = 12.sp,
                                                    color = TextSecondary
                                                )
                                                if (!item.reference_number.isNullOrBlank()) {
                                                    Text(text = "Ref: ${item.reference_number}", fontSize = 11.sp, color = TextSecondary)
                                                }
                                            }

                                            Text(
                                                text = currencyFormatter.format(item.amount),
                                                fontSize = 14.sp,
                                                fontWeight = FontWeight.ExtraBold,
                                                color = TextPrimary
                                            )

                                            if (!item.is_locked) {
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
                                                                deleteExpense(item)
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
                        text = if (isEditing) "Edit Expense" else "Record Expense",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    OutlinedTextField(
                        value = descriptionInput,
                        onValueChange = { descriptionInput = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Description (e.g. Stationery purchase)") },
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
                        placeholder = { Text("Amount") },
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
                        value = dateInput,
                        onValueChange = { dateInput = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Expense Date (YYYY-MM-DD)") },
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
                        value = categoryInput,
                        onValueChange = { categoryInput = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Category (e.g. Maintenance)") },
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
                        value = paymentMethodInput,
                        onValueChange = { paymentMethodInput = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Payment Method (e.g. Cash, UPI)") },
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
                            onClick = { saveExpense() },
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
