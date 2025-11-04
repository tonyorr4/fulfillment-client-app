// Sincro Fulfillment Client App - Frontend JavaScript
// Connects to backend API

// ==================== GLOBAL STATE ====================
let currentUser = null;
let allClients = [];
let allUsers = []; // All approved users for assignee dropdown
let currentClientCard = null;
let currentClientData = null; // Store current client data with fresh comments
let draggedCard = null;
let isDragging = false;
let dragStartTime = 0;
let currentStatusFilter = 'all';

// ==================== THEME MANAGEMENT ====================

// Initialize theme on page load
function initializeTheme() {
    // Check localStorage for saved theme preference
    const savedTheme = localStorage.getItem('theme') || 'light'; // Default to light
    applyTheme(savedTheme);
}

// Apply theme to document
function applyTheme(theme) {
    const html = document.documentElement;
    const themeIcon = document.getElementById('theme-icon');

    if (theme === 'dark') {
        html.setAttribute('data-theme', 'dark');
        if (themeIcon) {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        }
    } else {
        html.removeAttribute('data-theme');
        if (themeIcon) {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        }
    }

    // Save to localStorage
    localStorage.setItem('theme', theme);
}

// Toggle between light and dark theme
function toggleTheme() {
    console.log('🌙 Theme toggle clicked');
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    console.log(`Switching from ${currentTheme || 'light'} to ${newTheme}`);
    applyTheme(newTheme);
}

// ==================== AUTHENTICATION ====================

// Check authentication status on page load
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/user', {
            credentials: 'include'
        });

        // Handle rate limiting
        if (response.status === 429) {
            console.error('Rate limit exceeded');
            const errorData = await response.json().catch(() => ({ message: 'Too many requests' }));
            showToast(errorData.message || 'Too many requests. Please wait and try again.', 'error');
            return;
        }

        // Handle non-JSON responses
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.authenticated) {
            currentUser = data.user;
            displayUser(currentUser);
            await loadAllUsers(); // Load users for assignee dropdown
            await loadAllClients();
        } else {
            // Redirect to Google OAuth login
            window.location.href = '/auth/google';
        }
    } catch (error) {
        console.error('Error checking auth:', error);
        showToast('Authentication error. Please refresh.', 'error');
    }
}

// Display user info in header
function displayUser(user) {
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');

    if (!userAvatar || !userName) {
        console.error('User display elements not found');
        return;
    }

    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
    userAvatar.textContent = initials;
    userName.textContent = user.name;

    if (user.picture) {
        userAvatar.style.backgroundImage = `url(${user.picture})`;
        userAvatar.style.backgroundSize = 'cover';
        userAvatar.textContent = '';
    }

    // Show Automations tab for admin users
    console.log('🔐 User role check:', {
        name: user.name,
        role: user.role,
        is_admin: user.is_admin,
        will_show_automations: user.is_admin || user.role === 'Admin'
    });

    // DEPLOYMENT NOTE: Set FORCE_SHOW_AUTOMATIONS = true to always show automations tab for testing
    const FORCE_SHOW_AUTOMATIONS = false; // Change to true for deployment testing

    if (user.is_admin || user.role === 'Admin' || FORCE_SHOW_AUTOMATIONS) {
        const automationsTab = document.getElementById('automations-tab');
        if (automationsTab) {
            automationsTab.style.display = 'block';
            console.log('✅ Automations tab shown (admin or force enabled)');
        } else {
            console.error('❌ Automations tab element not found in DOM');
        }
    } else {
        console.log('ℹ️ Automations tab hidden (user is not admin)');
    }
}

// Logout
function logout() {
    window.location.href = '/auth/logout';
}

// Load all approved users for assignee dropdown
async function loadAllUsers() {
    try {
        const response = await fetch('/api/users/all', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch users');
        }

        const data = await response.json();
        allUsers = data.users || [];
        console.log(`📥 Loaded ${allUsers.length} users for assignee dropdown`);
    } catch (error) {
        console.error('Error loading users:', error);
        showToast('Failed to load users', 'error');
    }
}

// Populate assignee dropdown
function populateAssigneeDropdown() {
    const assigneeSelect = document.getElementById('subtaskAssigneeSelect');
    if (!assigneeSelect) return;

    // Clear existing options except the first one
    assigneeSelect.innerHTML = '<option value="">Assign to...</option>';

    // Add current user as first option (default)
    if (currentUser) {
        const currentUserOption = document.createElement('option');
        currentUserOption.value = currentUser.name;
        currentUserOption.textContent = `${currentUser.name} (me)`;
        currentUserOption.selected = true;
        assigneeSelect.appendChild(currentUserOption);
    }

    // Add all other users
    allUsers.forEach(user => {
        if (user.name !== currentUser?.name) {
            const option = document.createElement('option');
            option.value = user.name;
            option.textContent = user.name;
            assigneeSelect.appendChild(option);
        }
    });
}

// ==================== CLIENT OPERATIONS ====================

// Load all clients from API
async function loadAllClients() {
    try {
        const response = await fetch('/api/clients', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch clients');
        }

        allClients = await response.json();

        console.log(`📥 Received ${allClients.length} clients from API`);
        if (allClients.length > 0) {
            console.log('Sample client data:', {
                client_id: allClients[0].client_id,
                client_name: allClients[0].client_name,
                sales_team: allClients[0].sales_team,
                client_type: allClients[0].client_type,
                avg_orders: allClients[0].avg_orders,
                status: allClients[0].status
            });
        }

        renderAllClients();

    } catch (error) {
        console.error('Error loading clients:', error);
        showToast('Failed to load clients', 'error');
    }
}

// Update filter counts
function updateFilterCounts() {
    // Count clients by status
    const counts = {
        'all': allClients.length,
        'new-request': 0,
        'signing': 0,
        'client-setup': 0,
        'setup-complete': 0,
        'inbound': 0,
        'fulfilling': 0,
        'complete': 0,
        'not-pursuing': 0
    };

    allClients.forEach(client => {
        if (counts.hasOwnProperty(client.status)) {
            counts[client.status]++;
        }
    });

    // Update each filter pill count
    document.querySelectorAll('.filter-pill').forEach(pill => {
        const filter = pill.getAttribute('data-filter');
        const countSpan = pill.querySelector('.filter-count');
        if (countSpan && counts.hasOwnProperty(filter)) {
            countSpan.textContent = `(${counts[filter]})`;
        }
    });
}

// Render all clients on the board
function renderAllClients() {
    const cardGrid = document.getElementById('cardGrid');
    if (!cardGrid) {
        console.error('Card grid container not found');
        return;
    }

    // Clear the grid
    cardGrid.innerHTML = '';

    // Update filter counts
    updateFilterCounts();

    // Filter clients based on current status filter
    let filteredClients = allClients;
    if (currentStatusFilter !== 'all') {
        filteredClients = allClients.filter(client => client.status === currentStatusFilter);
    }

    // Render each client as a card
    filteredClients.forEach(client => {
        const card = createClientCardElement(client);
        cardGrid.appendChild(card);
    });

    // Show empty state if no clients
    if (filteredClients.length === 0) {
        cardGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--text-tertiary);">
                <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                <p style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">No clients found</p>
                <p style="font-size: 14px;">Try adjusting your filters or search query</p>
            </div>
        `;
    }
}

// Create client card element
function createClientCardElement(client) {
    console.log(`🎴 Creating card for client:`, {
        id: client.id,
        client_id: client.client_id,
        client_name: client.client_name,
        sales_team: client.sales_team,
        client_type: client.client_type,
        avg_orders: client.avg_orders
    });

    const card = document.createElement('div');
    card.className = `card status-${client.status}`;
    card.setAttribute('data-id', client.id);
    card.setAttribute('data-client-data', JSON.stringify(client));
    card.setAttribute('data-status', client.status);

    // Format date
    const dateObj = new Date(client.est_inbound_date);
    const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

    // Get initials for logo
    const clientInitials = client.client_name
        .split(' ')
        .map(word => word[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

    // Status label
    const statusLabels = {
        'new-request': 'New Request',
        'signing': 'Signing',
        'client-setup': 'Client Setup',
        'setup-complete': 'Setup Complete',
        'inbound': 'Inbound',
        'fulfilling': 'Fulfilling',
        'complete': 'Complete',
        'not-pursuing': 'Not Pursuing'
    };

    // Approval indicator
    let approvalIndicator = '';
    if (client.auto_approved || client.client_approved === 'yes') {
        approvalIndicator = `
            <div class="approval-indicator approved">
                <i class="fas fa-check-circle"></i>
            </div>
        `;
    } else if (client.status === 'new-request') {
        approvalIndicator = `
            <div class="approval-indicator review">
                <i class="fas fa-exclamation-circle"></i>
            </div>
        `;
    }

    // Subtasks count
    const completedSubtasks = client.subtasks ? client.subtasks.filter(s => s.completed).length : 0;
    const totalSubtasks = client.subtasks ? client.subtasks.length : 0;

    // Comments count
    const commentsCount = client.comments ? client.comments.length : 0;

    // Assignee avatars
    const salesInitials = getInitials(client.sales_team);
    const opsInitials = getInitials(client.fulfillment_ops);

    // Priority (you can add this field to your database or calculate it)
    const priority = 'medium'; // Default - you can make this dynamic

    card.innerHTML = `
        ${approvalIndicator}
        <div class="card-banner">
            <div class="card-logo">${clientInitials}</div>
        </div>
        <div class="card-body">
            <div class="card-header">
                <span class="card-id">${client.client_id}</span>
            </div>
            <div class="card-name">${client.client_name}</div>
            <div class="status-badge">
                <span class="status-dot"></span>
                ${statusLabels[client.status] || client.status}
            </div>
            <div class="card-meta-grid">
                <div class="meta-box">
                    <div class="meta-label">Est. Inbound</div>
                    <div class="meta-value">${formattedDate}</div>
                </div>
                <div class="meta-box">
                    <div class="meta-label">Orders/Mo</div>
                    <div class="meta-value">${client.avg_orders || '-'}</div>
                </div>
            </div>
            <div class="meta-box" style="margin-bottom: 16px;">
                <div class="meta-label">Client Type</div>
                <div class="meta-value" style="font-size: 12px;">${client.client_type || '-'}</div>
            </div>
            <div class="card-footer">
                <div class="assignees">
                    <div class="avatar sales" title="Sales: ${client.sales_team}">${salesInitials}</div>
                    <div class="avatar fulfillment" title="Fulfillment: ${client.fulfillment_ops}">${opsInitials}</div>
                </div>
                <div class="card-stats">
                    <div class="stat-badge">
                        <i class="fas fa-check"></i>
                        ${completedSubtasks}/${totalSubtasks}
                    </div>
                    <div class="stat-badge">
                        <i class="far fa-comment"></i>
                        ${commentsCount}
                    </div>
                </div>
            </div>
        </div>
    `;

    card.addEventListener('click', function(e) {
        openClientDetail(client.id);
    });

    return card;
}

// Submit new fulfillment request
async function submitNewRequest(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/api/clients', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Failed to create client');
        }

        const result = await response.json();

        // Show success message
        if (result.autoApproved) {
            showToast('Request submitted and AUTO-APPROVED! Moved to Signing.', 'success');
        } else {
            showToast('Request submitted. In New Request column awaiting manual review.', 'success');
        }

        // Close modal and reset form
        closeModal('newRequestModal');
        event.target.reset();

        // Reload clients
        await loadAllClients();

    } catch (error) {
        console.error('Error submitting request:', error);
        showToast('Failed to submit request. Please try again.', 'error');
    }
}

// Update client status (drag and drop or manual change)
async function updateClientStatus(clientId, newStatus) {
    try {
        const response = await fetch(`/api/clients/${clientId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) {
            throw new Error('Failed to update status');
        }

        // Reload clients to get updated data (including auto-created subtasks)
        await loadAllClients();

        return true;
    } catch (error) {
        console.error('Error updating status:', error);
        showToast('Failed to update status', 'error');
        return false;
    }
}

// Update client approval
async function handleClientApproval(value) {
    if (!currentClientCard) return;

    const clientData = JSON.parse(currentClientCard.getAttribute('data-client-data'));

    try {
        const response = await fetch(`/api/clients/${clientData.id}/approval`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ approval: value })
        });

        if (!response.ok) {
            throw new Error('Failed to update approval');
        }

        let message = '';
        if (value === 'yes') {
            message = 'Client approved! Moved to Signing.';
        } else if (value === 'no') {
            message = 'Client marked as not pursuing.';
        } else if (value === 'auto-approve') {
            message = 'Auto-approved! Moved to Signing.';
        }

        showToast(message, value === 'no' ? 'error' : 'success');

        // Close modal
        setTimeout(() => {
            closeModal('clientDetailModal');
        }, 500);

        // Reload clients
        await loadAllClients();

    } catch (error) {
        console.error('Error updating approval:', error);
        showToast('Failed to update approval', 'error');
    }
}

// Handle status change from dropdown
async function handleStatusChange(newStatus) {
    if (!currentClientCard) {
        console.error('No current client card reference');
        return;
    }

    const clientData = JSON.parse(currentClientCard.getAttribute('data-client-data'));

    try {
        console.log(`Changing status from ${clientData.status} to ${newStatus}`);

        const success = await updateClientStatus(clientData.id, newStatus);

        if (success) {
            const statusNames = {
                'new-request': 'New Request',
                'signing': 'Signing',
                'client-setup': 'Client Setup',
                'setup-complete': 'Setup Complete - Pending Inbound',
                'inbound': 'Inbound',
                'fulfilling': 'Fulfilling',
                'complete': 'Complete',
                'not-pursuing': 'Not Pursuing'
            };

            showToast(`Client moved to ${statusNames[newStatus]}`, 'success');

            // Close modal after a brief delay
            setTimeout(() => {
                closeModal('clientDetailModal');
            }, 500);
        }
    } catch (error) {
        console.error('Error in handleStatusChange:', error);
        showToast('Failed to update status', 'error');
    }
}

// Delete client
async function deleteClient() {
    if (!currentClientCard) return;

    const clientData = JSON.parse(currentClientCard.getAttribute('data-client-data'));

    if (confirm(`Are you sure you want to delete ${clientData.client_name}?`)) {
        try {
            const response = await fetch(`/api/clients/${clientData.id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to delete client');
            }

            showToast('Client deleted', 'error');
            closeModal('clientDetailModal');

            // Reload clients
            await loadAllClients();

        } catch (error) {
            console.error('Error deleting client:', error);
            showToast('Failed to delete client', 'error');
        }
    }
}

// ==================== CLIENT DETAIL MODAL ====================

// Open client detail modal
async function openClientDetail(clientId) {
    try {
        console.log('Opening client detail for ID:', clientId);

        // Fetch full client details with comments and subtasks
        const response = await fetch(`/api/clients/${clientId}`, {
            credentials: 'include'
        });

        console.log('Fetch response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to fetch client:', errorText);
            throw new Error('Failed to load client details');
        }

        const clientDetails = await response.json();
        console.log('Client details received:', clientDetails);

        // Store current client data (with fresh comments) and card reference
        currentClientData = clientDetails;
        currentClientCard = document.querySelector(`.card[data-id="${clientId}"]`);

        // Show modal FIRST
        document.getElementById('clientDetailModal').classList.add('active');

        // Then populate data (wrapped in try-catch so errors don't break modal display)
        try {
            populateClientDetailModal(clientDetails);
        } catch (populateError) {
            console.error('Error populating modal (modal still shown):', populateError);
        }

        // Initialize mention autocomplete
        initializeMentionAutocomplete();

    } catch (error) {
        console.error('Error opening client detail:', error);
        showToast('Failed to load client details', 'error');
    }
}

// Populate client detail modal with data
function populateClientDetailModal(client) {
    console.log('Populating modal for client:', client);

    try {
        // Set status dropdown to current client status
        const statusSelect = document.getElementById('clientStatusSelect');
        if (statusSelect && client.status) {
            statusSelect.value = client.status;
            console.log('Set status dropdown to:', client.status);
        }

        // Set approval dropdown
        const approvalSelect = document.getElementById('clientApprovalSelect');
        if (approvalSelect) {
            if (client.auto_approved) {
                approvalSelect.value = 'auto-approve';
            } else if (client.client_approved === 'yes') {
                approvalSelect.value = 'yes';
            } else if (client.client_approved === 'no') {
                approvalSelect.value = 'no';
            } else {
                approvalSelect.value = '';
            }
        }

        // Update client ID and name in header
        const cardIdEl = document.querySelector('#clientDetailModal .card-id');
        if (cardIdEl) cardIdEl.textContent = client.client_id || 'N/A';

        const titleEl = document.querySelector('#clientDetailModal h2');
        if (titleEl) titleEl.textContent = client.client_name || 'Unnamed Client';

        // Update description - find the FIRST p tag in the FIRST detail-section
        const firstDetailSection = document.querySelector('#clientDetailModal .detail-section');
        if (firstDetailSection) {
            const descEl = firstDetailSection.querySelector('p');
            if (descEl) {
                descEl.textContent = client.additional_info || 'No additional information provided.';
            }
        }

        // Load subtasks
        loadSubtasksIntoModal(client.subtasks || []);

        // Populate assignee dropdown for new subtasks
        populateAssigneeDropdown();

        // Load comments
        loadCommentsIntoModal(client.comments || []);

        // Load attachments
        loadAttachmentsIntoModal(client.attachments || []);

        // Update sidebar fields
        updateSidebarFields(client);

        // Apply role-based permissions for UI elements
        applyRoleBasedPermissions();

        console.log('Modal populated successfully');
    } catch (error) {
        console.error('Error in populateClientDetailModal:', error);
        throw error;
    }
}

// Apply role-based permissions to UI elements
function applyRoleBasedPermissions() {
    // Check if current user is Sales
    const isSalesRole = currentUser && currentUser.role === 'Sales';

    // Hide Edit Details button for Sales users
    const editButton = document.getElementById('editButton');
    if (editButton) {
        editButton.style.display = isSalesRole ? 'none' : 'block';
    }

    // Hide status dropdown for Sales users
    const statusSelect = document.getElementById('clientStatusSelect');
    if (statusSelect) {
        if (isSalesRole) {
            statusSelect.disabled = true;
            statusSelect.style.opacity = '0.5';
            statusSelect.style.cursor = 'not-allowed';
        } else {
            statusSelect.disabled = false;
            statusSelect.style.opacity = '1';
            statusSelect.style.cursor = 'pointer';
        }
    }

    // Hide approval dropdown for Sales users
    const approvalSelect = document.getElementById('clientApprovalSelect');
    if (approvalSelect) {
        if (isSalesRole) {
            approvalSelect.disabled = true;
            approvalSelect.style.opacity = '0.5';
            approvalSelect.style.cursor = 'not-allowed';
        } else {
            approvalSelect.disabled = false;
            approvalSelect.style.opacity = '1';
            approvalSelect.style.cursor = 'pointer';
        }
    }
}

// Load subtasks into modal
function loadSubtasksIntoModal(subtasks) {
    try {
        const subtaskList = document.querySelector('.subtask-list');
        if (!subtaskList) {
            console.warn('Subtask list element not found');
            return;
        }

        subtaskList.innerHTML = '';

        if (!subtasks || subtasks.length === 0) {
            subtaskList.innerHTML = '<li style="color: #5e6c84; padding: 10px;">No subtasks yet</li>';
            return;
        }

        subtasks.forEach(subtask => {
            const li = document.createElement('li');
            li.className = 'subtask-item';

            // Create checkbox
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'subtask-checkbox';
            checkbox.checked = subtask.completed;
            checkbox.onchange = () => toggleSubtask(subtask.id);

            // Create text span
            const textSpan = document.createElement('span');
            textSpan.className = `subtask-text ${subtask.completed ? 'completed' : ''}`;
            textSpan.textContent = subtask.subtask_text;

            // Create assignee dropdown
            const assigneeSelect = document.createElement('select');
            assigneeSelect.className = 'subtask-assignee-change';
            assigneeSelect.title = `Assigned to: ${subtask.assignee}`;
            assigneeSelect.onchange = () => changeSubtaskAssignee(subtask.id, assigneeSelect.value);

            // Add options to assignee dropdown
            allUsers.forEach(user => {
                const option = document.createElement('option');
                option.value = user.name;
                option.textContent = user.name;
                if (user.name === subtask.assignee) {
                    option.selected = true;
                }
                assigneeSelect.appendChild(option);
            });

            li.appendChild(checkbox);
            li.appendChild(textSpan);
            li.appendChild(assigneeSelect);
            subtaskList.appendChild(li);
        });
    } catch (error) {
        console.error('Error loading subtasks:', error);
    }
}

// Toggle subtask completion
async function toggleSubtask(subtaskId) {
    try {
        const response = await fetch(`/api/subtasks/${subtaskId}/toggle`, {
            method: 'PATCH',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to toggle subtask');
        }

        // Reload current client details
        if (currentClientCard) {
            const clientData = JSON.parse(currentClientCard.getAttribute('data-client-data'));
            await openClientDetail(clientData.id);
        }

        // Reload all clients to update task counts on cards
        await loadAllClients();

    } catch (error) {
        console.error('Error toggling subtask:', error);
        showToast('Failed to update subtask', 'error');
    }
}

// Change subtask assignee
async function changeSubtaskAssignee(subtaskId, newAssignee) {
    try {
        const response = await fetch(`/api/subtasks/${subtaskId}/assignee`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ assignee: newAssignee })
        });

        if (!response.ok) {
            throw new Error('Failed to change subtask assignee');
        }

        showToast(`Assignee changed to ${newAssignee}`, 'success');

        // Reload current client details
        if (currentClientCard) {
            const clientData = JSON.parse(currentClientCard.getAttribute('data-client-data'));
            await openClientDetail(clientData.id);
        }

        // Reload all clients
        await loadAllClients();

    } catch (error) {
        console.error('Error changing subtask assignee:', error);
        showToast('Failed to change assignee', 'error');
    }
}

// Add new subtask
async function addSubtask() {
    if (!currentClientCard) return;

    const clientData = JSON.parse(currentClientCard.getAttribute('data-client-data'));
    const input = document.getElementById('subtaskInput');
    const assigneeSelect = document.getElementById('subtaskAssigneeSelect');
    const subtaskText = input.value.trim();
    const assignee = assigneeSelect.value || currentUser.name;

    if (!subtaskText) {
        showToast('Please enter a subtask description', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/clients/${clientData.id}/subtasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                subtaskText,
                assignee
            })
        });

        if (!response.ok) {
            throw new Error('Failed to create subtask');
        }

        input.value = '';
        // Reset assignee dropdown to current user
        if (currentUser) {
            assigneeSelect.value = currentUser.name;
        }
        showToast('Subtask added', 'success');

        // Reload client details
        await openClientDetail(clientData.id);

        // Reload all clients
        await loadAllClients();

    } catch (error) {
        console.error('Error adding subtask:', error);
        showToast('Failed to add subtask', 'error');
    }
}

// Global state for comment threads
let commentThreadState = {
    repliesByParent: {},
    collapsed: new Set() // Set of collapsed comment IDs
};

// Load comments into modal (with threading support - unlimited nesting)
function loadCommentsIntoModal(comments) {
    try {
        // Find comments section - use simpler selector
        const commentBox = document.querySelector('.comment-box');
        if (!commentBox) {
            console.warn('Comment box not found');
            return;
        }

        // Remove existing comments
        const existingComments = document.querySelectorAll('.comment');
        existingComments.forEach(c => c.remove());

        if (!comments || comments.length === 0) {
            console.log('No comments to display');
            return;
        }

        // Build a map of replies by parent ID (for all levels)
        commentThreadState.repliesByParent = {};
        comments.forEach(comment => {
            if (comment.parent_comment_id) {
                if (!commentThreadState.repliesByParent[comment.parent_comment_id]) {
                    commentThreadState.repliesByParent[comment.parent_comment_id] = [];
                }
                commentThreadState.repliesByParent[comment.parent_comment_id].push(comment);
            }
        });

        // Find top-level comments (no parent)
        const parentComments = comments.filter(c => !c.parent_comment_id);

        // Render parent comments and their replies recursively
        parentComments.forEach(comment => {
            renderCommentThread(comment, commentBox, 0);
        });
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

// Recursively render a comment and all its replies
function renderCommentThread(comment, commentBox, depth) {
    // Check if this comment has replies
    const replies = commentThreadState.repliesByParent[comment.id] || [];
    const hasReplies = replies.length > 0;

    // Render this comment
    renderComment(comment, commentBox, depth, hasReplies);

    // Only render children if not collapsed
    if (!commentThreadState.collapsed.has(comment.id)) {
        // Recursively render all replies to this comment
        replies.forEach(reply => {
            renderCommentThread(reply, commentBox, depth + 1);
        });
    }
}

// Render a single comment
function renderComment(comment, commentBox, depth, hasReplies) {
    const commentEl = document.createElement('div');
    commentEl.className = 'comment' + (depth > 0 ? ' comment-reply' : '');
    commentEl.dataset.commentId = comment.id;
    commentEl.dataset.depth = depth;

    const initials = getInitials(comment.user_name);
    const timeAgo = formatTimeAgo(new Date(comment.created_at));
    const isOwnComment = currentUser && comment.user_id === currentUser.id;
    const editedIndicator = comment.edited_at ? '<span class="edited-indicator">(edited)</span>' : '';

    // Calculate indentation based on depth
    const indentStyle = depth > 0 ? `style="margin-left: ${depth * 48}px;"` : '';

    // Count total replies (recursively)
    const replyCount = hasReplies ? countReplies(comment.id) : 0;
    const isCollapsed = commentThreadState.collapsed.has(comment.id);

    // Collapse/expand button if has replies
    const collapseBtn = hasReplies ? `
        <button class="comment-collapse-btn" onclick="toggleCommentThread(${comment.id})" title="${isCollapsed ? 'Expand' : 'Collapse'} thread">
            <i class="fas fa-${isCollapsed ? 'plus' : 'minus'}-square"></i>
            ${isCollapsed ? `<span class="reply-count">${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}</span>` : ''}
        </button>
    ` : '';

    // Like button with tooltip
    const likes = comment.likes || [];
    const likeCount = likes.length;
    const userHasLiked = currentUser && likes.some(like => like.user_id === currentUser.id);
    const likeButtonClass = userHasLiked ? 'comment-action-btn like-btn liked' : 'comment-action-btn like-btn';
    const likeTooltip = likes.length > 0 ? likes.map(like => like.user_name).join(', ') : '';

    commentEl.innerHTML = `
        <div class="comment-avatar">${initials}</div>
        <div class="comment-content" ${indentStyle}>
            <div class="comment-header">
                <span class="comment-author">${comment.user_name}</span>
                <span class="comment-time">${timeAgo} ${editedIndicator}</span>
                ${collapseBtn}
            </div>
            <div class="comment-text" data-comment-id="${comment.id}">${highlightMentions(comment.comment_text)}</div>
            <div class="comment-actions">
                <button class="${likeButtonClass}" onclick="toggleLike(${comment.id})" title="${likeTooltip}">
                    <i class="fas fa-heart"></i> ${likeCount > 0 ? likeCount : ''}
                </button>
                <button class="comment-action-btn reply-btn" onclick="replyToComment(${comment.id}, '${escapeHtml(comment.user_name)}')">
                    <i class="fas fa-reply"></i> Reply
                </button>
                ${isOwnComment ? `
                    <button class="comment-action-btn edit-btn" onclick="editComment(${comment.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                ` : ''}
            </div>
        </div>
    `;

    commentBox.parentNode.insertBefore(commentEl, commentBox);
}

// Count all replies recursively
function countReplies(commentId) {
    const directReplies = commentThreadState.repliesByParent[commentId] || [];
    let count = directReplies.length;

    // Add nested replies
    directReplies.forEach(reply => {
        count += countReplies(reply.id);
    });

    return count;
}

// Toggle comment thread collapse/expand
function toggleCommentThread(commentId) {
    if (commentThreadState.collapsed.has(commentId)) {
        commentThreadState.collapsed.delete(commentId);
    } else {
        commentThreadState.collapsed.add(commentId);
    }

    // Re-render comments using fresh data
    if (currentClientData) {
        loadCommentsIntoModal(currentClientData.comments || []);
    }
}

// Toggle like on a comment
async function toggleLike(commentId) {
    try {
        const response = await fetch(`/api/comments/${commentId}/like`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to toggle like');
        }

        const result = await response.json();

        // Update the comment in currentClientData
        if (currentClientData && currentClientData.comments) {
            const comment = currentClientData.comments.find(c => c.id === commentId);
            if (comment) {
                comment.likes = result.likes;
            }
        }

        // Re-render comments to show updated likes
        if (currentClientData) {
            loadCommentsIntoModal(currentClientData.comments || []);
        }
    } catch (error) {
        console.error('Error toggling like:', error);
        showToast('Failed to toggle like', 'error');
    }
}

// ==================== MENTION AUTOCOMPLETE ====================

// Highlight mentions in comment text
function highlightMentions(text) {
    // First escape HTML
    const escaped = escapeHtml(text);

    // Then wrap @mentions in span tags
    // Match @FirstName only (no spaces - just first names)
    const mentionRegex = /@([A-Za-z]+)(?=\s|$|[^\w])/g;

    return escaped.replace(mentionRegex, '<span class="mention">$&</span>');
}

let mentionState = {
    isActive: false,
    startPos: -1,
    searchText: '',
    selectedIndex: 0,
    filteredUsers: []
};

// Initialize mention autocomplete when modal opens
function initializeMentionAutocomplete() {
    const textarea = document.getElementById('commentTextarea');
    const dropdown = document.getElementById('mentionDropdown');

    if (!textarea || !dropdown) return;

    // Handle input changes
    textarea.addEventListener('input', handleMentionInput);

    // Handle keyboard navigation
    textarea.addEventListener('keydown', handleMentionKeydown);

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!textarea.contains(e.target) && !dropdown.contains(e.target)) {
            hideMentionDropdown();
        }
    });
}

// Handle input in textarea
function handleMentionInput(e) {
    const textarea = e.target;
    const text = textarea.value;
    const cursorPos = textarea.selectionStart;

    // Find @ symbol before cursor
    let atPos = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
        if (text[i] === '@') {
            // Check if @ is at start or preceded by whitespace
            if (i === 0 || /\s/.test(text[i - 1])) {
                atPos = i;
                break;
            }
        } else if (/\s/.test(text[i])) {
            // Stop if we hit whitespace before finding @
            break;
        }
    }

    if (atPos !== -1) {
        // Extract search text after @
        const searchText = text.substring(atPos + 1, cursorPos);

        // Only show dropdown if search text doesn't contain spaces
        if (!/\s/.test(searchText)) {
            mentionState.isActive = true;
            mentionState.startPos = atPos;
            mentionState.searchText = searchText;
            mentionState.selectedIndex = 0;

            // Filter users based on search text
            filterAndShowMentions(searchText);
            return;
        }
    }

    // Hide dropdown if conditions not met
    hideMentionDropdown();
}

// Filter users and show dropdown
function filterAndShowMentions(searchText) {
    const search = searchText.toLowerCase();

    // Filter users by name
    mentionState.filteredUsers = allUsers.filter(user =>
        user.name.toLowerCase().includes(search)
    );

    if (mentionState.filteredUsers.length === 0) {
        hideMentionDropdown();
        return;
    }

    // Render dropdown
    renderMentionDropdown();
    positionMentionDropdown();
}

// Render mention dropdown
function renderMentionDropdown() {
    const dropdown = document.getElementById('mentionDropdown');
    if (!dropdown) return;

    dropdown.innerHTML = '';

    mentionState.filteredUsers.forEach((user, index) => {
        const item = document.createElement('div');
        item.className = 'mention-item';
        if (index === mentionState.selectedIndex) {
            item.classList.add('selected');
        }

        item.innerHTML = `
            <span class="mention-item-name">${user.name}</span>
            <span class="mention-item-email">${user.email || ''}</span>
        `;

        item.addEventListener('click', () => selectMentionUser(user));

        dropdown.appendChild(item);
    });

    dropdown.classList.add('active');
}

// Position dropdown below cursor
function positionMentionDropdown() {
    const textarea = document.getElementById('commentTextarea');
    const dropdown = document.getElementById('mentionDropdown');

    if (!textarea || !dropdown) return;

    // Simple positioning below textarea
    dropdown.style.top = (textarea.offsetHeight + 5) + 'px';
    dropdown.style.left = '0px';
}

// Handle keyboard navigation
function handleMentionKeydown(e) {
    if (!mentionState.isActive) return;

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            mentionState.selectedIndex = Math.min(
                mentionState.selectedIndex + 1,
                mentionState.filteredUsers.length - 1
            );
            renderMentionDropdown();
            break;

        case 'ArrowUp':
            e.preventDefault();
            mentionState.selectedIndex = Math.max(
                mentionState.selectedIndex - 1,
                0
            );
            renderMentionDropdown();
            break;

        case 'Enter':
        case 'Tab':
            if (mentionState.filteredUsers.length > 0) {
                e.preventDefault();
                const selectedUser = mentionState.filteredUsers[mentionState.selectedIndex];
                selectMentionUser(selectedUser);
            }
            break;

        case 'Escape':
            e.preventDefault();
            hideMentionDropdown();
            break;
    }
}

// Select a user from dropdown
function selectMentionUser(user) {
    const textarea = document.getElementById('commentTextarea');
    if (!textarea) return;

    const text = textarea.value;
    const beforeMention = text.substring(0, mentionState.startPos);
    const afterCursor = text.substring(textarea.selectionStart);

    // Extract first name only
    const firstName = user.name.split(' ')[0];

    // Insert mention with @ symbol and add space after (first name only)
    const newText = beforeMention + '@' + firstName + ' ' + afterCursor;
    textarea.value = newText;

    // Set cursor position after the mention
    const newCursorPos = beforeMention.length + firstName.length + 2; // +2 for @ and space
    textarea.selectionStart = newCursorPos;
    textarea.selectionEnd = newCursorPos;

    // Focus textarea
    textarea.focus();

    // Hide dropdown
    hideMentionDropdown();
}

// Hide mention dropdown
function hideMentionDropdown() {
    const dropdown = document.getElementById('mentionDropdown');
    if (dropdown) {
        dropdown.classList.remove('active');
        dropdown.innerHTML = '';
    }

    mentionState.isActive = false;
    mentionState.startPos = -1;
    mentionState.searchText = '';
    mentionState.selectedIndex = 0;
    mentionState.filteredUsers = [];
}

// Parse mentions from comment text
function parseMentions(text) {
    const mentionedUserIds = [];

    // Regex to match @FirstName patterns (no spaces - first names only)
    const mentionRegex = /@([A-Za-z]+)(?=\s|$|[^\w])/g;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
        const mentionedFirstName = match[1].trim();

        // Find user by first name
        const user = allUsers.find(u => {
            const firstName = u.name.split(' ')[0];
            return firstName.toLowerCase() === mentionedFirstName.toLowerCase();
        });

        if (user && !mentionedUserIds.includes(user.id)) {
            mentionedUserIds.push(user.id);
        }
    }

    return mentionedUserIds;
}

// Comment state for reply and edit
let commentState = {
    replyToId: null,
    replyToName: null,
    editingCommentId: null
};

// Reply to comment
function replyToComment(commentId, userName) {
    commentState.replyToId = commentId;
    commentState.replyToName = userName;
    commentState.editingCommentId = null;

    const textarea = document.querySelector('.comment-box textarea');
    const commentBox = document.querySelector('.comment-box');

    // Show reply indicator
    const existingIndicator = document.querySelector('.reply-indicator');
    if (existingIndicator) existingIndicator.remove();

    const replyIndicator = document.createElement('div');
    replyIndicator.className = 'reply-indicator';
    replyIndicator.innerHTML = `
        Replying to <strong>${escapeHtml(userName)}</strong>
        <button class="cancel-reply-btn" onclick="cancelReply()">✕</button>
    `;
    commentBox.insertBefore(replyIndicator, textarea);

    textarea.focus();
}

// Cancel reply
function cancelReply() {
    commentState.replyToId = null;
    commentState.replyToName = null;

    const replyIndicator = document.querySelector('.reply-indicator');
    if (replyIndicator) replyIndicator.remove();
}

// Edit comment
function editComment(commentId) {
    commentState.editingCommentId = commentId;
    commentState.replyToId = null;

    const commentTextEl = document.querySelector(`.comment-text[data-comment-id="${commentId}"]`);
    const currentText = commentTextEl.textContent.trim();

    const textarea = document.querySelector('.comment-box textarea');
    const commentBox = document.querySelector('.comment-box');

    // Show edit indicator
    const existingIndicator = document.querySelector('.edit-indicator');
    if (existingIndicator) existingIndicator.remove();

    const editIndicator = document.createElement('div');
    editIndicator.className = 'edit-indicator';
    editIndicator.innerHTML = `
        Editing comment
        <button class="cancel-edit-btn" onclick="cancelEdit()">✕</button>
    `;
    commentBox.insertBefore(editIndicator, textarea);

    textarea.value = currentText;
    textarea.focus();
}

// Cancel edit
function cancelEdit() {
    commentState.editingCommentId = null;

    const textarea = document.querySelector('.comment-box textarea');
    textarea.value = '';

    const editIndicator = document.querySelector('.edit-indicator');
    if (editIndicator) editIndicator.remove();
}

// Add new comment (or reply, or edit)
async function addComment() {
    if (!currentClientCard) return;

    const clientData = JSON.parse(currentClientCard.getAttribute('data-client-data'));
    const textarea = document.querySelector('.comment-box textarea');
    const commentText = textarea.value.trim();

    if (!commentText) {
        showToast('Please enter a comment', 'error');
        return;
    }

    // If editing, call edit endpoint
    if (commentState.editingCommentId) {
        try {
            const response = await fetch(`/api/comments/${commentState.editingCommentId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    commentText
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to edit comment');
            }

            textarea.value = '';
            cancelEdit();
            showToast('Comment edited', 'success');

            // Reload client details
            await openClientDetail(clientData.id);

        } catch (error) {
            console.error('Error editing comment:', error);
            showToast(error.message || 'Failed to edit comment', 'error');
        }
        return;
    }

    // Parse mentions from comment text
    const mentionedUsers = parseMentions(commentText);

    try {
        const response = await fetch(`/api/clients/${clientData.id}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                commentText,
                mentionedUsers,
                parentCommentId: commentState.replyToId
            })
        });

        if (!response.ok) {
            throw new Error('Failed to add comment');
        }

        textarea.value = '';
        cancelReply();
        showToast(commentState.replyToId ? 'Reply added' : 'Comment added', 'success');

        // Reload client details
        await openClientDetail(clientData.id);

    } catch (error) {
        console.error('Error adding comment:', error);
        showToast('Failed to add comment', 'error');
    }
}

// ==================== ATTACHMENTS ====================

// Load attachments into modal
function loadAttachmentsIntoModal(attachments) {
    const attachmentList = document.querySelector('.attachment-list');
    if (!attachmentList) return;

    attachmentList.innerHTML = '';

    if (!attachments || attachments.length === 0) {
        return;
    }

    attachments.forEach(attachment => {
        const div = document.createElement('div');
        div.className = 'attachment-preview-box';

        // Get file icon based on type
        const icon = getFileIcon(attachment.file_type);

        // Format file size
        const fileSize = formatFileSize(attachment.file_size);

        const canDelete = currentUser && (attachment.uploaded_by === currentUser.id || currentUser.role === 'Admin');

        // Check if it's an image to show thumbnail
        const isImage = attachment.file_type && attachment.file_type.startsWith('image/');

        if (isImage) {
            // Show image thumbnail
            div.innerHTML = `
                <div class="attachment-preview-image">
                    <img src="/api/attachments/${attachment.id}/download" alt="${escapeHtml(attachment.original_name)}">
                    <div class="attachment-overlay">
                        <div class="attachment-overlay-actions">
                            <button class="attachment-overlay-btn" onclick="downloadAttachment(${attachment.id}, '${escapeHtml(attachment.original_name).replace(/'/g, "\\'")}')">
                                <i class="fas fa-download"></i>
                            </button>
                            ${canDelete ? `
                                <button class="attachment-overlay-btn delete" onclick="deleteAttachment(${attachment.id})">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
                <div class="attachment-preview-info">
                    <div class="attachment-preview-name">${escapeHtml(attachment.original_name)}</div>
                    <div class="attachment-preview-size">${fileSize}</div>
                </div>
            `;
        } else {
            // Show icon preview for non-images
            div.innerHTML = `
                <div class="attachment-preview-icon">
                    <div class="attachment-preview-icon-wrapper">
                        <i class="fas fa-${icon}"></i>
                    </div>
                    <div class="attachment-overlay">
                        <div class="attachment-overlay-actions">
                            <button class="attachment-overlay-btn" onclick="downloadAttachment(${attachment.id}, '${escapeHtml(attachment.original_name).replace(/'/g, "\\'")}')">
                                <i class="fas fa-download"></i>
                            </button>
                            ${canDelete ? `
                                <button class="attachment-overlay-btn delete" onclick="deleteAttachment(${attachment.id})">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
                <div class="attachment-preview-info">
                    <div class="attachment-preview-name">${escapeHtml(attachment.original_name)}</div>
                    <div class="attachment-preview-size">${fileSize}</div>
                </div>
            `;
        }

        attachmentList.appendChild(div);
    });
}

// Get file icon based on MIME type
function getFileIcon(mimeType) {
    if (!mimeType) return 'file';

    if (mimeType.startsWith('image/')) return 'file-image';
    if (mimeType.includes('pdf')) return 'file-pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'file-word';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'file-excel';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return 'file-archive';
    if (mimeType.includes('text')) return 'file-alt';

    return 'file';
}

// Format file size in human-readable format
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Handle file selection
async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
        showToast('File size must be less than 10MB', 'error');
        event.target.value = '';
        return;
    }

    if (!currentClientData) {
        showToast('No client selected', 'error');
        return;
    }

    // Upload file
    const formData = new FormData();
    formData.append('file', file);

    try {
        showToast('Uploading file...', 'info');

        const response = await fetch(`/api/clients/${currentClientData.id}/attachments`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to upload file');
        }

        const result = await response.json();

        showToast('File uploaded successfully', 'success');

        // Reload client details to show new attachment
        await openClientDetail(currentClientData.id);

        // Clear file input
        event.target.value = '';

    } catch (error) {
        console.error('Error uploading file:', error);
        showToast(error.message || 'Failed to upload file', 'error');
        event.target.value = '';
    }
}

// Download attachment
async function downloadAttachment(attachmentId, fileName) {
    try {
        window.open(`/api/attachments/${attachmentId}/download`, '_blank');
    } catch (error) {
        console.error('Error downloading attachment:', error);
        showToast('Failed to download file', 'error');
    }
}

// Delete attachment
async function deleteAttachment(attachmentId) {
    if (!confirm('Are you sure you want to delete this attachment?')) {
        return;
    }

    try {
        const response = await fetch(`/api/attachments/${attachmentId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete attachment');
        }

        showToast('Attachment deleted', 'success');

        // Reload client details
        if (currentClientData) {
            await openClientDetail(currentClientData.id);
        }

    } catch (error) {
        console.error('Error deleting attachment:', error);
        showToast(error.message || 'Failed to delete attachment', 'error');
    }
}

// Update sidebar fields
function updateSidebarFields(client) {
    try {
        console.log('📝 Updating sidebar fields with client data:', client);

        // Email
        const emailEl = document.getElementById('detailEmail');
        if (emailEl) emailEl.textContent = client.client_email || 'Not provided';

        // Client ID (already set in header, but also in details)
        const clientIdEl = document.getElementById('detailClientId');
        if (clientIdEl) clientIdEl.textContent = client.client_id || '-';

        // Est. Inbound Date
        const inboundDateEl = document.getElementById('detailInboundDate');
        if (inboundDateEl && client.est_inbound_date) {
            const formattedDate = new Date(client.est_inbound_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
            inboundDateEl.textContent = formattedDate;
        }

        // Client Type
        const clientTypeEl = document.getElementById('detailClientType');
        if (clientTypeEl) clientTypeEl.textContent = client.client_type || '-';

        // Avg Orders/Month
        const avgOrdersEl = document.getElementById('detailAvgOrders');
        if (avgOrdersEl) avgOrdersEl.textContent = client.avg_orders || '-';

        // Unique SKUs
        const numSkusEl = document.getElementById('detailNumSkus');
        if (numSkusEl) numSkusEl.textContent = client.num_skus || '-';

        // Battery/DG
        const batteryEl = document.getElementById('detailBattery');
        if (batteryEl) batteryEl.textContent = client.battery || '-';

        // Heavy SKU
        const heavySkuEl = document.getElementById('detailHeavySku');
        if (heavySkuEl) heavySkuEl.textContent = client.heavy_sku || 'Not specified';

        // Est. Pallets
        const numPalletsEl = document.getElementById('detailNumPallets');
        if (numPalletsEl) numPalletsEl.textContent = client.num_pallets || '-';

        // Special Packaging
        const specialPackagingEl = document.getElementById('detailSpecialPackaging');
        if (specialPackagingEl) specialPackagingEl.textContent = client.special_packaging || '-';

        // Barcoding
        const barcodingEl = document.getElementById('detailBarcoding');
        if (barcodingEl) barcodingEl.textContent = client.barcoding || '-';

        // Created date
        const createdEl = document.getElementById('detailCreated');
        if (createdEl && client.created_at) {
            const createdDate = new Date(client.created_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            createdEl.textContent = createdDate;
        }

        // Updated date
        const updatedEl = document.getElementById('detailUpdated');
        if (updatedEl && client.updated_at) {
            const updatedDate = new Date(client.updated_at);
            updatedEl.textContent = formatTimeAgo(updatedDate);
        }

        // Sales Team (in Assigned To section)
        const salesTeamEl = document.getElementById('detailSalesTeam');
        if (salesTeamEl) {
            salesTeamEl.textContent = client.sales_team || 'Not assigned';
            console.log('✓ Sales Team set to:', client.sales_team);
        }

        // Fulfillment Ops (in Assigned To section)
        const fulfillmentOpsEl = document.getElementById('detailFulfillmentOps');
        if (fulfillmentOpsEl) {
            fulfillmentOpsEl.textContent = client.fulfillment_ops || 'Not assigned';
        }

        console.log('✓ Sidebar fields updated successfully');
    } catch (error) {
        console.error('Error updating sidebar fields:', error);
    }
}

// ==================== DRAG AND DROP ====================
// Note: Drag and drop removed for grid layout.
// Status can be changed via the detail modal dropdown.

// ==================== UTILITY FUNCTIONS ====================

function formatStatusName(status) {
    const statusNames = {
        'new-request': 'New Request',
        'signing': 'Signing',
        'client-setup': 'Client Setup',
        'setup-complete': 'Setup Complete - Pending Inbound',
        'inbound': 'Inbound',
        'fulfilling': 'Fulfilling',
        'complete': 'Complete',
        'not-pursuing': 'Not Pursuing'
    };
    return statusNames[status] || status;
}

function getInitials(name) {
    if (!name || name === 'Unassigned') return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + ' years ago';

    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + ' months ago';

    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + ' days ago';

    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + ' hours ago';

    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + ' minutes ago';

    return Math.floor(seconds) + ' seconds ago';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    toastMessage.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

async function openNewRequestModal() {
    document.getElementById('newRequestModal').classList.add('active');

    // Fetch Admin and Sales users for dropdown
    try {
        const response = await fetch('/api/users/by-role?roles=Admin,Sales', {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            const dropdown = document.querySelector('#newRequestModal select[name="salesTeam"]');
            // Clear existing options except first
            dropdown.innerHTML = '<option value="">Select Sales Rep...</option>';

            // Add users dynamically
            data.users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.name;
                option.setAttribute('data-email', user.email); // Store email for future email alerts
                option.textContent = user.name;
                dropdown.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading sales team members:', error);
        showToast('Failed to load sales team members', 'error');
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Filter by status (status pills)
function filterByStatus(status, buttonElement) {
    currentStatusFilter = status;

    // Update active pill
    document.querySelectorAll('.filter-pill').forEach(pill => {
        pill.classList.remove('active');
    });
    if (buttonElement) {
        buttonElement.classList.add('active');
    }

    // Re-render clients with new filter
    renderAllClients();
}

// Search filter - searches ALL clients regardless of status filter
function filterCards() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    const cardGrid = document.getElementById('cardGrid');

    if (!cardGrid) {
        return;
    }

    // If no search term, show all clients based on current filter
    if (!searchTerm) {
        renderAllClients();
        return;
    }

    // Clear the grid
    cardGrid.innerHTML = '';

    // Search through ALL clients (ignoring status filter)
    const matchingClients = allClients.filter(client => {
        const clientName = (client.client_name || '').toLowerCase();
        const clientId = (client.client_id || '').toLowerCase();

        return clientName.includes(searchTerm) || clientId.includes(searchTerm);
    });

    // Render matching clients
    matchingClients.forEach(client => {
        const card = createClientCardElement(client);
        cardGrid.appendChild(card);
    });

    // Show empty state if no matches
    if (matchingClients.length === 0) {
        cardGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--text-tertiary);">
                <i class="fas fa-search" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                <p style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">No matches found</p>
                <p style="font-size: 14px;">No clients match "${searchTerm}"</p>
                <button onclick="showAllCards()" style="margin-top: 16px; padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer;">Clear Search</button>
            </div>
        `;
    } else {
        // Add notice that search results are across all statuses
        const notice = document.createElement('div');
        notice.style.cssText = 'grid-column: 1/-1; background: var(--info-light, #e3f2fd); border-left: 4px solid var(--info, #2196F3); padding: 12px 16px; margin-bottom: 16px; border-radius: 4px;';
        notice.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <i class="fas fa-info-circle" style="color: var(--info, #2196F3);"></i>
                <span style="flex: 1;">Showing ${matchingClients.length} result(s) from <strong>all statuses</strong></span>
                <button onclick="showAllCards()" style="padding: 4px 12px; background: var(--info, #2196F3); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">Clear</button>
            </div>
        `;
        cardGrid.insertBefore(notice, cardGrid.firstChild);
    }
}

function showAllCards() {
    document.getElementById('searchInput').value = '';
    currentStatusFilter = 'all';

    // Reset active pill to "All Clients"
    document.querySelectorAll('.filter-pill').forEach(pill => {
        pill.classList.remove('active');
        if (pill.getAttribute('data-filter') === 'all') {
            pill.classList.add('active');
        }
    });

    renderAllClients();
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}

// ==================== EDIT MODE FUNCTIONALITY ====================

let isEditMode = false;
let originalClientData = null;

// Toggle edit mode
function toggleEditMode() {
    isEditMode = true;

    // Store original data
    if (!currentClientCard) return;
    originalClientData = JSON.parse(currentClientCard.getAttribute('data-client-data'));

    // Hide Edit button, show Save/Cancel buttons
    document.getElementById('editButton').style.display = 'none';
    document.getElementById('editActions').style.display = 'flex';

    // Convert fields to editable inputs
    makeFieldsEditable();
}

// Cancel edit mode
function cancelEditMode() {
    isEditMode = false;

    // Show Edit button, hide Save/Cancel buttons
    document.getElementById('editButton').style.display = 'block';
    document.getElementById('editActions').style.display = 'none';

    // Restore original data
    if (originalClientData) {
        updateSidebarFields(originalClientData);
    }

    originalClientData = null;
}

// Make fields editable
function makeFieldsEditable() {
    const editableFields = [
        { id: 'detailClientId', key: 'client_id', type: 'input', inputType: 'text' },
        { id: 'detailInboundDate', key: 'est_inbound_date', type: 'input', inputType: 'date' },
        { id: 'detailEmail', key: 'client_email', type: 'input', inputType: 'email' },
        { id: 'detailClientType', key: 'client_type', type: 'select', options: ['eFulfillment', 'Crowd Funding', 'Dropship'] },
        { id: 'detailAvgOrders', key: 'avg_orders', type: 'select', options: ['<100', '100-500', '500-1000', '1000-2500', '2500-5000', '5000+'] },
        { id: 'detailNumSkus', key: 'num_skus', type: 'select', options: ['<25', '25-100', '100-250', '250-500', '500+'] },
        { id: 'detailBattery', key: 'battery', type: 'select', options: ['Yes', 'No', 'N/A'] },
        { id: 'detailHeavySku', key: 'heavy_sku', type: 'select', options: ['Yes', 'No', 'N/A'] },
        { id: 'detailNumPallets', key: 'num_pallets', type: 'select', options: ['<20', '20-50', '50-100', '100+'] },
        { id: 'detailSpecialPackaging', key: 'special_packaging', type: 'select', options: ['Yes', 'No', 'N/A'] },
        { id: 'detailBarcoding', key: 'barcoding', type: 'select', options: ['Yes', 'No', 'N/A'] }
    ];

    editableFields.forEach(field => {
        const el = document.getElementById(field.id);
        if (!el) return;

        let currentValue = el.textContent;

        // Special handling for date fields - convert to YYYY-MM-DD format
        if (field.inputType === 'date' && originalClientData && originalClientData[field.key]) {
            const dateObj = new Date(originalClientData[field.key]);
            if (!isNaN(dateObj.getTime())) {
                // Format as YYYY-MM-DD for date input
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');
                currentValue = `${year}-${month}-${day}`;
            }
        }

        if (field.type === 'input') {
            el.innerHTML = `<input type="${field.inputType || 'text'}" class="detail-field-input" value="${escapeHtml(currentValue)}" data-field="${field.key}">`;
        } else if (field.type === 'select') {
            let options = field.options.map(opt =>
                `<option value="${opt}" ${opt === currentValue ? 'selected' : ''}>${opt}</option>`
            ).join('');
            el.innerHTML = `<select class="detail-field-select" data-field="${field.key}">${options}</select>`;
        }
    });

    // Make Sales Team editable (dynamic user dropdown)
    const salesTeamEl = document.getElementById('detailSalesTeam');
    if (salesTeamEl && allUsers.length > 0) {
        const currentValue = salesTeamEl.textContent;
        let options = allUsers.map(user =>
            `<option value="${user.name}" ${user.name === currentValue ? 'selected' : ''}>${user.name}</option>`
        ).join('');
        salesTeamEl.innerHTML = `<select class="detail-field-select" data-field="sales_team">${options}</select>`;
    }

    // Make Fulfillment Ops editable (dynamic user dropdown)
    const fulfillmentOpsEl = document.getElementById('detailFulfillmentOps');
    if (fulfillmentOpsEl && allUsers.length > 0) {
        const currentValue = fulfillmentOpsEl.textContent;
        let options = allUsers.map(user =>
            `<option value="${user.name}" ${user.name === currentValue ? 'selected' : ''}>${user.name}</option>`
        ).join('');
        fulfillmentOpsEl.innerHTML = `<select class="detail-field-select" data-field="fulfillment_ops">${options}</select>`;
    }

    // Additional Info textarea (find it by looking for the field)
    const additionalInfoSection = document.querySelector('.detail-section:has(h3)');
    if (additionalInfoSection) {
        // This needs special handling - let's skip it for now or handle it separately
    }
}

// Save client details
async function saveClientDetails() {
    if (!currentClientCard) return;

    try {
        const clientData = JSON.parse(currentClientCard.getAttribute('data-client-data'));

        // Collect updated values
        const updates = {};

        // Get values from input/select elements
        document.querySelectorAll('.detail-field-input, .detail-field-select, .detail-field-textarea').forEach(el => {
            const field = el.getAttribute('data-field');
            if (field) {
                updates[field] = el.value || null;
            }
        });

        // Validation
        if (Object.keys(updates).length === 0) {
            showToast('No changes to save', 'error');
            return;
        }

        // Send PATCH request
        const response = await fetch(`/api/clients/${clientData.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(updates)
        });

        if (!response.ok) {
            throw new Error('Failed to update client');
        }

        const result = await response.json();

        showToast('Client details updated successfully', 'success');

        // Exit edit mode
        isEditMode = false;
        document.getElementById('editButton').style.display = 'block';
        document.getElementById('editActions').style.display = 'none';

        // Reload client details and all clients
        await openClientDetail(clientData.id);
        await loadAllClients();

    } catch (error) {
        console.error('Error saving client details:', error);
        showToast('Failed to save changes', 'error');
    }
}

// ==================== REPORTING ====================

let reportCharts = {
    statusChart: null,
    clientTypeChart: null,
    trendChart: null,
    approvalRateChart: null,
    autoApprovalRateChart: null,
    inboundTimelineChart: null
};

// Load reports data and render charts
async function loadReports() {
    try {
        const response = await fetch('/api/reports/pipeline-overview', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch reports');
        }

        const result = await response.json();
        const data = result.data;

        // Update KPI cards
        document.getElementById('kpi-total-clients').textContent = data.totalClients;
        document.getElementById('kpi-this-week').textContent = data.clientsThisWeek;
        document.getElementById('kpi-this-month').textContent = data.clientsThisMonth;
        document.getElementById('kpi-backlog').textContent = data.backlogSize;
        document.getElementById('kpi-active').textContent = data.activeClients;

        // Render charts
        renderStatusChart(data.statusCounts);
        renderClientTypeChart(data.clientTypes);
        renderTrendChart(data.newClientsTrend);

        // Load monthly summary
        await loadMonthlySummary();

        // Load inbound dates report
        await loadInboundDates();

        // Load open subtasks report
        await loadOpenSubtasks();

    } catch (error) {
        console.error('Error loading reports:', error);
        showToast('Failed to load reports', 'error');
    }
}

// Load monthly summary data
async function loadMonthlySummary() {
    try {
        const response = await fetch('/api/reports/monthly-summary', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch monthly summary');
        }

        const result = await response.json();
        const data = result.data;

        // Update KPI cards
        document.getElementById('kpi-month-added').textContent = data.clientsAddedThisMonth;
        document.getElementById('kpi-approval-rate').textContent = data.currentApprovalRate + '%';
        document.getElementById('kpi-auto-approval-rate').textContent = data.currentAutoApprovalRate + '%';

        // Update month-over-month change
        const changeEl = document.getElementById('kpi-month-change');
        const change = data.clientsAddedChange;
        const changeText = change > 0 ? `+${change}%` : `${change}%`;
        const changeColor = change > 0 ? '#4CAF50' : (change < 0 ? '#F44336' : '#888');
        changeEl.innerHTML = `<span style="color: ${changeColor};">${changeText}</span> <span style="color: #888;">vs last month</span>`;

        // Render trend charts
        renderApprovalRateChart(data.approvalRateTrend);
        renderAutoApprovalRateChart(data.autoApprovalRateTrend);

    } catch (error) {
        console.error('Error loading monthly summary:', error);
        showToast('Failed to load monthly summary', 'error');
    }
}

// Load inbound dates report data
async function loadInboundDates() {
    try {
        const response = await fetch('/api/reports/inbound-dates', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch inbound dates report');
        }

        const result = await response.json();
        const data = result.data;

        // Update KPI cards
        document.getElementById('kpi-ib-total').textContent = data.totalClients;
        document.getElementById('kpi-ib-week').textContent = data.thisWeek;
        document.getElementById('kpi-ib-month').textContent = data.thisMonth;
        document.getElementById('kpi-ib-30days').textContent = data.next30Days;
        document.getElementById('kpi-ib-avg').textContent = data.avgDaysUntilInbound;
        document.getElementById('kpi-ib-overdue').textContent = data.overdueCount;

        // Store overdue clients data for toggle function
        window.overdueClientsData = data.overdueClients || [];

        // Update overdue KPI card visibility
        const overdueKpiCard = document.getElementById('overdue-kpi-card');
        if (data.overdueCount > 0) {
            overdueKpiCard.style.display = 'block';
        } else {
            overdueKpiCard.style.display = 'none';
        }

        // Render tables and charts
        renderInboundDatesTable(data.clients);
        renderInboundTimelineChart(data.clientsByWeek);

    } catch (error) {
        console.error('Error loading inbound dates report:', error);
        showToast('Failed to load inbound dates report', 'error');
    }
}

// Render inbound dates table
function renderInboundDatesTable(clients) {
    const tbody = document.getElementById('inbound-dates-tbody');
    if (!tbody) return;

    if (clients.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="padding: 40px; text-align: center; color: var(--text-tertiary);">
                    <i class="fas fa-calendar-times" style="font-size: 24px; margin-bottom: 12px;"></i>
                    <div>No upcoming inbound dates found</div>
                </td>
            </tr>
        `;
        return;
    }

    // Status label and color mapping
    const statusMap = {
        'client-setup': { label: 'Client Setup', color: '#2196F3' },
        'setup-complete': { label: 'Setup Complete', color: '#4CAF50' },
        'inbound': { label: 'Inbound', color: '#FF9800' },
        'complete': { label: 'Complete', color: '#8BC34A' }
    };

    tbody.innerHTML = clients.map((client, index) => {
        const status = statusMap[client.status] || { label: client.status, color: '#888' };
        const date = new Date(client.est_inbound_date);
        const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        // Color code days until inbound
        let daysColor = '#4CAF50'; // green for >14 days
        if (client.days_until_inbound <= 7) {
            daysColor = '#F44336'; // red for <=7 days
        } else if (client.days_until_inbound <= 14) {
            daysColor = '#FF9800'; // orange for 8-14 days
        }

        return `
            <tr style="border-bottom: 1px solid var(--border-color); ${index % 2 === 0 ? 'background: var(--bg-elevated);' : ''}">
                <td style="padding: 12px; font-size: 14px; color: var(--text-primary);">${client.client_id || '--'}</td>
                <td style="padding: 12px; font-size: 14px; font-weight: 500; color: var(--text-primary);">${client.client_name || '--'}</td>
                <td style="padding: 12px;">
                    <span style="
                        display: inline-block;
                        padding: 4px 12px;
                        border-radius: 12px;
                        font-size: 12px;
                        font-weight: 600;
                        background: ${status.color}22;
                        color: ${status.color};
                    ">${status.label}</span>
                </td>
                <td style="padding: 12px; font-size: 14px; color: var(--text-primary);">${formattedDate}</td>
                <td style="padding: 12px; font-size: 14px; font-weight: 600; color: ${daysColor};">
                    ${client.days_until_inbound} ${client.days_until_inbound === 1 ? 'day' : 'days'}
                </td>
                <td style="padding: 12px; font-size: 14px; color: var(--text-secondary);">${client.sales_team || '--'}</td>
                <td style="padding: 12px; font-size: 14px; color: var(--text-secondary);">${client.fulfillment_ops || '--'}</td>
            </tr>
        `;
    }).join('');
}

// Scroll to section in Reports tab
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Toggle overdue section visibility
function toggleOverdueSection() {
    const overdueSection = document.getElementById('overdue-section');
    const chevron = document.getElementById('overdue-chevron');
    const kpiCard = document.getElementById('overdue-kpi-card');

    if (overdueSection.style.display === 'none' || !overdueSection.style.display) {
        // Show section
        overdueSection.style.display = 'block';
        if (chevron) chevron.className = 'fas fa-chevron-up';
        if (kpiCard) kpiCard.style.transform = 'scale(0.98)';

        // Render table data if not already rendered
        if (window.overdueClientsData && window.overdueClientsData.length > 0) {
            renderOverdueDatesTable(window.overdueClientsData);
        }

        // Scroll to overdue section
        setTimeout(() => {
            overdueSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    } else {
        // Hide section
        overdueSection.style.display = 'none';
        if (chevron) chevron.className = 'fas fa-chevron-down';
        if (kpiCard) kpiCard.style.transform = 'scale(1)';
    }
}

// Render overdue dates table
function renderOverdueDatesTable(clients) {
    const tbody = document.getElementById('overdue-dates-tbody');
    if (!tbody) return;

    if (clients.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="padding: 40px; text-align: center; color: var(--text-tertiary);">
                    <div>No overdue clients found</div>
                </td>
            </tr>
        `;
        return;
    }

    // Status label and color mapping
    const statusMap = {
        'client-setup': { label: 'Client Setup', color: '#2196F3' },
        'setup-complete': { label: 'Setup Complete', color: '#4CAF50' },
        'inbound': { label: 'Inbound', color: '#FF9800' },
        'complete': { label: 'Complete', color: '#8BC34A' }
    };

    tbody.innerHTML = clients.map((client, index) => {
        const status = statusMap[client.status] || { label: client.status, color: '#888' };
        const date = new Date(client.est_inbound_date);
        const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        return `
            <tr style="border-bottom: 1px solid var(--border-color); ${index % 2 === 0 ? 'background: var(--bg-elevated);' : ''}">
                <td style="padding: 12px; font-size: 14px; color: var(--text-primary);">${client.client_id || '--'}</td>
                <td style="padding: 12px; font-size: 14px; font-weight: 500; color: var(--text-primary);">${client.client_name || '--'}</td>
                <td style="padding: 12px;">
                    <span style="
                        display: inline-block;
                        padding: 4px 12px;
                        border-radius: 12px;
                        font-size: 12px;
                        font-weight: 600;
                        background: ${status.color}22;
                        color: ${status.color};
                    ">${status.label}</span>
                </td>
                <td style="padding: 12px; font-size: 14px; color: var(--text-primary);">${formattedDate}</td>
                <td style="padding: 12px; font-size: 14px; font-weight: 700; color: #F44336;">
                    ${client.days_overdue} ${client.days_overdue === 1 ? 'day' : 'days'} overdue
                </td>
                <td style="padding: 12px; font-size: 14px; color: var(--text-secondary);">${client.sales_team || '--'}</td>
                <td style="padding: 12px; font-size: 14px; color: var(--text-secondary);">${client.fulfillment_ops || '--'}</td>
            </tr>
        `;
    }).join('');
}

// Render inbound timeline chart
function renderInboundTimelineChart(weeklyData) {
    const ctx = document.getElementById('inboundTimelineChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (reportCharts.inboundTimelineChart) {
        reportCharts.inboundTimelineChart.destroy();
    }

    if (!weeklyData || weeklyData.length === 0) {
        ctx.parentElement.innerHTML = '<p style="text-align: center; color: var(--text-tertiary); padding: 40px;">No data available</p>';
        return;
    }

    // Prepare data for chart
    const labels = weeklyData.map(w => w.week);
    const counts = weeklyData.map(w => w.count);

    reportCharts.inboundTimelineChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Clients Inbound',
                data: counts,
                backgroundColor: '#2196F3',
                borderColor: '#1976D2',
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14 },
                    bodyFont: { size: 13 },
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y} client${context.parsed.y !== 1 ? 's' : ''}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: { size: 11 },
                        color: '#888'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    ticks: {
                        font: { size: 11 },
                        color: '#888'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Load open subtasks report
async function loadOpenSubtasks() {
    try {
        const response = await fetch('/api/reports/open-subtasks', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch open subtasks report');
        }

        const result = await response.json();
        const data = result.data;

        // Update KPI cards
        document.getElementById('kpi-open-clients').textContent = data.summary.totalClients;
        document.getElementById('kpi-open-total').textContent = data.summary.totalOpenSubtasks;
        document.getElementById('kpi-open-assigned').textContent = data.summary.assignedSubtasks;
        document.getElementById('kpi-open-unassigned').textContent = data.summary.unassignedSubtasks;

        // Render assignee breakdown
        renderAssigneeBreakdown(data.byAssignee);

        // Render clients table
        renderOpenSubtasksTable(data.clients);

    } catch (error) {
        console.error('Error loading open subtasks report:', error);
        showToast('Failed to load open subtasks report', 'error');
    }
}

// Render assignee breakdown
function renderAssigneeBreakdown(byAssignee) {
    const container = document.getElementById('assignee-breakdown');
    if (!container) return;

    if (byAssignee.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-tertiary);">No open subtasks</div>';
        return;
    }

    container.innerHTML = byAssignee.map(item => {
        const isUnassigned = item.assignee === 'Unassigned';
        const bgColor = isUnassigned ? '#FF9800' : '#2196F3';

        return `
            <div style="background: var(--bg-elevated); padding: 16px; border-radius: 8px; border-left: 4px solid ${bgColor};">
                <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
                    ${item.assignee}
                </div>
                <div style="font-size: 24px; font-weight: 700; color: ${bgColor}; margin-bottom: 4px;">
                    ${item.count}
                </div>
                <div style="font-size: 12px; color: var(--text-secondary);">
                    ${item.client_count} client${item.client_count !== 1 ? 's' : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Render open subtasks table
function renderOpenSubtasksTable(clients) {
    const container = document.getElementById('open-subtasks-container');
    if (!container) return;

    if (clients.length === 0) {
        container.innerHTML = `
            <div style="padding: 40px; text-align: center; color: var(--text-tertiary);">
                <i class="fas fa-check-circle" style="font-size: 48px; margin-bottom: 12px; opacity: 0.5;"></i>
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">All Clear!</div>
                <div style="font-size: 14px;">No open subtasks found</div>
            </div>
        `;
        return;
    }

    // Status label mapping
    const statusMap = {
        'new-request': { label: 'New Request', color: '#2196F3' },
        'signing': { label: 'Signing', color: '#9C27B0' },
        'in-discussion': { label: 'In Discussion', color: '#FF9800' },
        'client-setup': { label: 'Client Setup', color: '#00BCD4' },
        'setup-complete': { label: 'Setup Complete', color: '#4CAF50' },
        'inbound': { label: 'Inbound', color: '#F44336' },
        'complete': { label: 'Complete', color: '#8BC34A' },
        'fulfilling': { label: 'Fulfilling', color: '#3F51B5' },
        'not-pursuing': { label: 'Not Pursuing', color: '#607D8B' }
    };

    const html = clients.map(client => {
        const status = statusMap[client.status] || { label: client.status, color: '#888' };

        return `
            <div style="background: var(--bg-elevated); padding: 20px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid ${status.color};">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                    <div>
                        <div style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
                            ${client.client_code} - ${client.client_name}
                        </div>
                        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                            <span style="
                                display: inline-block;
                                padding: 4px 12px;
                                border-radius: 12px;
                                font-size: 12px;
                                font-weight: 600;
                                background: ${status.color}22;
                                color: ${status.color};
                            ">${status.label}</span>
                            ${client.sales_team ? `<span style="font-size: 13px; color: var(--text-secondary);"><i class="fas fa-user"></i> Sales: ${client.sales_team}</span>` : ''}
                            ${client.fulfillment_ops ? `<span style="font-size: 13px; color: var(--text-secondary);"><i class="fas fa-user-cog"></i> Ops: ${client.fulfillment_ops}</span>` : ''}
                        </div>
                    </div>
                    <div style="background: #2196F3; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                        ${client.open_subtasks.length} open task${client.open_subtasks.length !== 1 ? 's' : ''}
                    </div>
                </div>
                <div style="margin-top: 12px;">
                    ${client.open_subtasks.map(subtask => {
                        const createdDate = new Date(subtask.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                        });
                        const isUnassigned = !subtask.assignee || subtask.assignee === 'Unassigned';

                        return `
                            <div style="background: var(--bg-card); padding: 12px; border-radius: 6px; margin-bottom: 8px; display: flex; align-items: center; gap: 12px;">
                                <i class="far fa-square" style="color: var(--text-secondary); font-size: 16px;"></i>
                                <div style="flex: 1;">
                                    <div style="font-size: 14px; color: var(--text-primary); margin-bottom: 4px;">${subtask.subtask_text}</div>
                                    <div style="font-size: 12px; color: var(--text-secondary);">
                                        Created ${createdDate}
                                        ${subtask.created_by_name ? ` by ${subtask.created_by_name}` : ''}
                                    </div>
                                </div>
                                <div style="padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; ${isUnassigned ? 'background: #FF980022; color: #FF9800;' : 'background: #4CAF5022; color: #4CAF50;'}">
                                    ${isUnassigned ? '⚠️ Unassigned' : subtask.assignee}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

// Render status distribution bar chart
function renderStatusChart(statusData) {
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (reportCharts.statusChart) {
        reportCharts.statusChart.destroy();
    }

    // Status labels mapping
    const statusLabels = {
        'new-request': 'New Request',
        'in-discussion': 'In Discussion',
        'approved': 'Approved',
        'in-progress': 'In Progress',
        'ready-for-inbound': 'Ready for Inbound',
        'receiving': 'Receiving',
        'complete': 'Complete'
    };

    // Status colors
    const statusColors = {
        'new-request': '#2196F3',
        'in-discussion': '#FF9800',
        'approved': '#4CAF50',
        'in-progress': '#9C27B0',
        'ready-for-inbound': '#00BCD4',
        'receiving': '#3F51B5',
        'complete': '#8BC34A'
    };

    const labels = statusData.map(item => statusLabels[item.status] || item.status);
    const counts = statusData.map(item => parseInt(item.count));
    const colors = statusData.map(item => statusColors[item.status] || '#666');

    reportCharts.statusChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Number of Clients',
                data: counts,
                backgroundColor: colors,
                borderColor: colors,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14 },
                    bodyFont: { size: 13 }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Render client type pie chart
function renderClientTypeChart(clientTypeData) {
    const ctx = document.getElementById('clientTypeChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (reportCharts.clientTypeChart) {
        reportCharts.clientTypeChart.destroy();
    }

    const labels = clientTypeData.map(item => item.client_type);
    const counts = clientTypeData.map(item => parseInt(item.count));
    const colors = ['#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#F44336'];

    reportCharts.clientTypeChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: { size: 13 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14 },
                    bodyFont: { size: 13 },
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${context.parsed} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Render trend line chart
function renderTrendChart(trendData) {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (reportCharts.trendChart) {
        reportCharts.trendChart.destroy();
    }

    // Format dates and counts
    const labels = trendData.map(item => {
        const date = new Date(item.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const counts = trendData.map(item => parseInt(item.count));

    reportCharts.trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'New Clients',
                data: counts,
                borderColor: '#2196F3',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#2196F3',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14 },
                    bodyFont: { size: 13 }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

// Render approval rate trend chart
function renderApprovalRateChart(trendData) {
    const ctx = document.getElementById('approvalRateChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (reportCharts.approvalRateChart) {
        reportCharts.approvalRateChart.destroy();
    }

    // Format months and rates
    const labels = trendData.map(item => {
        const date = new Date(item.month);
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });
    const rates = trendData.map(item => parseFloat(item.rate));

    reportCharts.approvalRateChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Approval Rate (%)',
                data: rates,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#4CAF50',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14 },
                    bodyFont: { size: 13 },
                    callbacks: {
                        label: function(context) {
                            return `Approval Rate: ${context.parsed.y}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Render auto-approval rate trend chart
function renderAutoApprovalRateChart(trendData) {
    const ctx = document.getElementById('autoApprovalRateChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (reportCharts.autoApprovalRateChart) {
        reportCharts.autoApprovalRateChart.destroy();
    }

    // Format months and rates
    const labels = trendData.map(item => {
        const date = new Date(item.month);
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });
    const rates = trendData.map(item => parseFloat(item.rate));

    reportCharts.autoApprovalRateChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Auto-Approval Rate (%)',
                data: rates,
                borderColor: '#2196F3',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#2196F3',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14 },
                    bodyFont: { size: 13 },
                    callbacks: {
                        label: function(context) {
                            return `Auto-Approval Rate: ${context.parsed.y}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// ==================== AUTOMATIONS ====================

let allAutomations = [];

// Switch between tabs
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    if (tabName === 'board') {
        document.getElementById('board-tab').classList.add('active');
    } else if (tabName === 'reports') {
        document.getElementById('reports-tab').classList.add('active');
        loadReports(); // Load reports when tab is opened
    } else if (tabName === 'logs') {
        document.getElementById('logs-tab').classList.add('active');
        populateUserFilter(); // Populate user filter dropdown
        loadLogs(); // Load logs when tab is opened
    } else if (tabName === 'automations') {
        document.getElementById('automations-tab-content').classList.add('active');
        loadAutomations(); // Load automations when tab is opened
    }
}

// Load all automations
async function loadAutomations() {
    try {
        const response = await fetch('/api/automations', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch automations');
        }

        allAutomations = await response.json();
        renderAutomations();
    } catch (error) {
        console.error('Error loading automations:', error);
        document.getElementById('automations-list').innerHTML = `
            <div class="automation-empty">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load automations</p>
            </div>
        `;
    }
}

// Render automations list
function renderAutomations() {
    const container = document.getElementById('automations-list');

    if (allAutomations.length === 0) {
        container.innerHTML = `
            <div class="automation-empty">
                <i class="fas fa-robot"></i>
                <p>No automations yet</p>
                <p style="font-size: 14px; margin-top: 8px;">Click "New Automation" to create your first rule</p>
            </div>
        `;
        return;
    }

    container.innerHTML = allAutomations.map(auto => `
        <div class="automation-card">
            <div class="automation-card-header">
                <div class="automation-card-title">
                    <h3>${escapeHtml(auto.name)}</h3>
                    <span class="automation-enabled-badge ${auto.enabled ? 'enabled' : 'disabled'}">
                        ${auto.enabled ? '✓ Enabled' : '⏸ Disabled'}
                    </span>
                </div>
                <div class="automation-card-actions">
                    <label class="toggle-switch">
                        <input type="checkbox" ${auto.enabled ? 'checked' : ''}
                               onchange="toggleAutomation(${auto.id}, this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                    <button class="btn-icon" onclick="editAutomation(${auto.id})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete" onclick="deleteAutomation(${auto.id})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="automation-card-body">
                ${auto.description ? `<p>${escapeHtml(auto.description)}</p>` : ''}
                <p><strong>Trigger:</strong> ${formatTriggerEvent(auto.trigger_event)}</p>
                <p><strong>Conditions:</strong> ${formatConditions(auto.conditions)}</p>
                <p><strong>Actions:</strong> ${formatActions(auto.actions)}</p>
            </div>
            <div class="automation-meta">
                <div class="automation-meta-item">
                    <i class="fas fa-sort-numeric-down"></i>
                    Order: ${auto.execution_order}
                </div>
                <div class="automation-meta-item">
                    <i class="fas fa-user"></i>
                    ${auto.created_by_name || 'System'}
                </div>
                <div class="automation-meta-item">
                    <i class="fas fa-calendar"></i>
                    ${formatDate(auto.created_at)}
                </div>
            </div>
        </div>
    `).join('');
}

// Format trigger event for display
function formatTriggerEvent(trigger) {
    const triggerNames = {
        'client_created': 'Client Created',
        'status_changed': 'Status Changed',
        'approval_changed': 'Approval Changed',
        'subtask_completed': 'Subtask Completed',
        'client_updated': 'Client Updated'
    };
    return triggerNames[trigger] || trigger;
}

// Format conditions for display
function formatConditions(conditions) {
    if (!conditions || (conditions.type === 'group' && conditions.conditions.length === 0)) {
        return '<em>Always (no conditions)</em>';
    }

    if (conditions.type === 'condition') {
        return `${conditions.field} ${conditions.operator} ${JSON.stringify(conditions.value)}`;
    }

    if (conditions.type === 'group') {
        const parts = conditions.conditions.map(c => {
            if (c.type === 'condition') {
                return `${c.field} ${c.operator} ${JSON.stringify(c.value)}`;
            }
            return '(nested group)';
        });
        return parts.join(` ${conditions.operator} `);
    }

    return '<em>Unknown</em>';
}

// Format actions for display
function formatActions(actions) {
    if (!actions || actions.length === 0) {
        return '<em>None</em>';
    }

    return actions.map(action => {
        if (action.type === 'set_field') {
            return `Set ${action.field} = ${JSON.stringify(action.value)}`;
        } else if (action.type === 'create_subtask') {
            const assignee = action.assignee_field ? `{${action.assignee_field}}` : action.assignee_static;
            return `Create subtask "${action.text}" (assign to: ${assignee})`;
        } else if (action.type === 'set_multiple_fields') {
            return `Set ${Object.keys(action.fields).length} fields`;
        }
        return action.type;
    }).join(', ');
}

// Toggle automation enabled/disabled
async function toggleAutomation(id, enabled) {
    try {
        const response = await fetch(`/api/automations/${id}/toggle`, {
            method: 'PATCH',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to toggle automation');
        }

        showToast(`Automation ${enabled ? 'enabled' : 'disabled'}`, 'success');
        await loadAutomations();
    } catch (error) {
        console.error('Error toggling automation:', error);
        showToast('Failed to toggle automation', 'error');
        await loadAutomations(); // Reload to reset UI
    }
}

// Delete automation
async function deleteAutomation(id) {
    if (!confirm('Are you sure you want to delete this automation? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`/api/automations/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to delete automation');
        }

        showToast('Automation deleted', 'success');
        await loadAutomations();
    } catch (error) {
        console.error('Error deleting automation:', error);
        showToast('Failed to delete automation', 'error');
    }
}

// ==================== AUTOMATION BUILDER WIZARD ====================

let wizardCurrentStep = 1;
let conditionIdCounter = 0;
let actionIdCounter = 0;
let editingAutomationId = null; // null = create mode, number = edit mode

// Available client fields for conditions
const clientFields = [
    { value: 'battery', label: 'Battery/DG' },
    { value: 'heavy_sku', label: 'Heavy SKU' },
    { value: 'num_pallets', label: 'Number of Pallets' },
    { value: 'num_skus', label: 'Number of SKUs' },
    { value: 'client_type', label: 'Client Type' },
    { value: 'avg_orders', label: 'Avg Orders/Month' },
    { value: 'status', label: 'Status' },
    { value: 'client_approved', label: 'Client Approved' },
    { value: 'special_packaging', label: 'Special Packaging' },
    { value: 'barcoding', label: 'Barcoding' }
];

// Available operators
const operators = [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'not contains' },
    { value: 'in', label: 'in' },
    { value: 'not_in', label: 'not in' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' }
];

// Writable client fields for actions
const writableFields = [
    { value: 'status', label: 'Status' },
    { value: 'client_approved', label: 'Client Approved' },
    { value: 'auto_approved', label: 'Auto Approved' },
    { value: 'fulfillment_ops', label: 'Fulfillment Ops' },
    { value: 'sales_team', label: 'Sales Team' },
    { value: 'heavy_sku', label: 'Heavy SKU' },
    { value: 'special_packaging', label: 'Special Packaging' },
    { value: 'barcoding', label: 'Barcoding' }
];

// Open automation modal
function openAutomationModal(automationId = null) {
    // Reset wizard state
    wizardCurrentStep = 1;
    conditionIdCounter = 0;
    actionIdCounter = 0;
    editingAutomationId = automationId; // Set edit mode if ID provided

    // Reset form
    document.getElementById('automation-name').value = '';
    document.getElementById('automation-description').value = '';
    document.getElementById('automation-trigger').value = '';
    document.getElementById('automation-order').value = '0';
    document.getElementById('automation-enabled').checked = true;

    // Reset condition builder
    document.getElementById('condition-mode').value = 'always';
    document.getElementById('condition-builder').style.display = 'none';
    document.querySelector('#root-condition-group .condition-list').innerHTML = '';

    // Reset action list
    document.getElementById('action-list').innerHTML = '';

    // Set modal title
    document.getElementById('automationModalTitle').textContent = automationId ? 'Edit Automation' : 'Create New Automation';

    // Show modal
    document.getElementById('automationModal').classList.add('active');

    // Go to step 1
    updateWizardStep(1);
}

// Edit existing automation
async function editAutomation(automationId) {
    try {
        // Fetch automation data
        const response = await fetch(`/api/automations/${automationId}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to load automation');
        }

        const automation = await response.json();

        // Open modal in edit mode
        openAutomationModal(automationId);

        // Populate Step 1: Basic Info
        document.getElementById('automation-name').value = automation.name || '';
        document.getElementById('automation-description').value = automation.description || '';
        document.getElementById('automation-trigger').value = automation.trigger_event || '';
        document.getElementById('automation-order').value = automation.execution_order || 0;
        document.getElementById('automation-enabled').checked = automation.enabled !== false;

        // Populate Step 2: Conditions
        const conditions = automation.conditions;
        if (conditions && conditions.type === 'group' && conditions.conditions.length > 0) {
            // Set to conditional mode
            document.getElementById('condition-mode').value = 'conditional';
            document.getElementById('condition-builder').style.display = 'block';

            // Set group operator
            const rootGroup = document.getElementById('root-condition-group');
            rootGroup.dataset.operator = conditions.operator || 'AND';
            rootGroup.querySelector('.condition-operator').value = conditions.operator || 'AND';

            // Add each condition
            conditions.conditions.forEach(cond => {
                addCondition('root-condition-group');
                const conditionItems = document.querySelectorAll('#root-condition-group .condition-item');
                const lastCondition = conditionItems[conditionItems.length - 1];

                lastCondition.querySelector('.field-select').value = cond.field || '';
                lastCondition.querySelector('.operator-select').value = cond.operator || 'equals';

                // Handle array values
                let displayValue = cond.value;
                if (Array.isArray(cond.value)) {
                    displayValue = cond.value.join(', ');
                }
                lastCondition.querySelector('.value-input').value = displayValue || '';
            });

            updateConditionPreview();
        }

        // Populate Step 3: Actions
        if (automation.actions && automation.actions.length > 0) {
            automation.actions.forEach(action => {
                if (action.type === 'set_field') {
                    addAction('set_field');
                    const actionItems = document.querySelectorAll('.action-item');
                    const lastAction = actionItems[actionItems.length - 1];

                    const fieldSelect = lastAction.querySelector('.action-field');
                    fieldSelect.value = action.field || '';

                    // Update the value input type based on field (dropdown for users, text for others)
                    updateActionValueInput(fieldSelect);

                    // Set the value after updating input type
                    lastAction.querySelector('.action-value').value = action.value || '';

                } else if (action.type === 'create_subtask') {
                    addAction('create_subtask');
                    const actionItems = document.querySelectorAll('.action-item');
                    const lastAction = actionItems[actionItems.length - 1];

                    lastAction.querySelector('.subtask-text').value = action.text || '';
                    lastAction.querySelector('.mark-auto-created').checked = action.mark_auto_created !== false;

                    if (action.assignee_field) {
                        lastAction.querySelector('.assignee-type').value = 'field';
                        lastAction.querySelector('.assignee-field').value = action.assignee_field;
                        lastAction.querySelector('.assignee-field-group').style.display = 'block';
                        lastAction.querySelector('.assignee-static-group').style.display = 'none';
                    } else if (action.assignee_static) {
                        lastAction.querySelector('.assignee-type').value = 'static';
                        lastAction.querySelector('.assignee-static').value = action.assignee_static;
                        lastAction.querySelector('.assignee-field-group').style.display = 'none';
                        lastAction.querySelector('.assignee-static-group').style.display = 'block';
                    }
                }
            });
        }

    } catch (error) {
        console.error('Error loading automation for edit:', error);
        showToast('Failed to load automation', 'error');
    }
}

// Close automation modal
function closeAutomationModal() {
    document.getElementById('automationModal').classList.remove('active');
    editingAutomationId = null; // Clear edit mode
}

// Update wizard step
function updateWizardStep(step) {
    wizardCurrentStep = step;

    // Update step indicators
    document.querySelectorAll('.wizard-step').forEach(el => {
        const stepNum = parseInt(el.dataset.step);
        el.classList.remove('active', 'completed');
        if (stepNum === step) {
            el.classList.add('active');
        } else if (stepNum < step) {
            el.classList.add('completed');
        }
    });

    // Update step content
    document.querySelectorAll('.wizard-step-content').forEach(el => {
        el.classList.remove('active');
    });
    document.getElementById(`wizard-step-${step}`).classList.add('active');

    // Update buttons
    document.getElementById('wizard-back-btn').style.display = step > 1 ? 'inline-block' : 'none';
    document.getElementById('wizard-next-btn').style.display = step < 3 ? 'inline-block' : 'none';
    document.getElementById('wizard-save-btn').style.display = step === 3 ? 'inline-block' : 'none';
}

// Next wizard step
function nextWizardStep() {
    // Validate current step
    if (wizardCurrentStep === 1) {
        const name = document.getElementById('automation-name').value.trim();
        const trigger = document.getElementById('automation-trigger').value;

        if (!name) {
            showToast('Please enter an automation name', 'error');
            return;
        }

        if (!trigger) {
            showToast('Please select a trigger event', 'error');
            return;
        }
    }

    if (wizardCurrentStep < 3) {
        updateWizardStep(wizardCurrentStep + 1);
    }
}

// Previous wizard step
function previousWizardStep() {
    if (wizardCurrentStep > 1) {
        updateWizardStep(wizardCurrentStep - 1);
    }
}

// Toggle condition mode (always vs conditional)
function toggleConditionMode() {
    const mode = document.getElementById('condition-mode').value;
    const builder = document.getElementById('condition-builder');
    builder.style.display = mode === 'conditional' ? 'block' : 'none';

    if (mode === 'conditional' && document.querySelector('#root-condition-group .condition-list').children.length === 0) {
        // Add first condition if none exist
        addCondition('root-condition-group');
    }

    updateConditionPreview();
}

// Add condition to group
function addCondition(groupId) {
    const conditionId = `condition-${conditionIdCounter++}`;
    const conditionList = document.querySelector(`#${groupId} .condition-list`);

    const conditionHtml = `
        <div class="condition-item" id="${conditionId}">
            <select class="field-select" onchange="updateConditionPreview()">
                <option value="">-- Select field --</option>
                ${clientFields.map(f => `<option value="${f.value}">${f.label}</option>`).join('')}
            </select>
            <select class="operator-select" onchange="updateConditionPreview()">
                ${operators.map(op => `<option value="${op.value}">${op.label}</option>`).join('')}
            </select>
            <input type="text" class="value-input" placeholder="Value" onchange="updateConditionPreview()">
            <button type="button" class="btn-icon delete" onclick="removeCondition('${conditionId}')" title="Remove">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    conditionList.insertAdjacentHTML('beforeend', conditionHtml);
    updateConditionPreview();
}

// Remove condition
function removeCondition(conditionId) {
    document.getElementById(conditionId).remove();
    updateConditionPreview();
}

// Update group operator
function updateGroupOperator(select) {
    const group = select.closest('.condition-group');
    group.dataset.operator = select.value;

    const span = group.querySelector('.condition-group-header span');
    span.textContent = select.value === 'AND' ? 'All conditions must be true' : 'At least one condition must be true';

    updateConditionPreview();
}

// Update condition preview
function updateConditionPreview() {
    const mode = document.getElementById('condition-mode').value;
    const previewEl = document.getElementById('condition-preview-text');

    if (mode === 'always') {
        previewEl.textContent = 'Always (no conditions)';
        return;
    }

    const rootGroup = document.getElementById('root-condition-group');
    const operator = rootGroup.dataset.operator;
    const conditions = Array.from(rootGroup.querySelectorAll('.condition-item'));

    if (conditions.length === 0) {
        previewEl.textContent = 'No conditions';
        return;
    }

    const parts = conditions.map(cond => {
        const field = cond.querySelector('.field-select').value;
        const op = cond.querySelector('.operator-select').value;
        const value = cond.querySelector('.value-input').value;

        if (!field) return '';

        return `${field} ${op} "${value}"`;
    }).filter(p => p);

    if (parts.length === 0) {
        previewEl.textContent = 'Incomplete conditions';
    } else {
        previewEl.textContent = parts.join(` ${operator} `);
    }
}

// Show action menu
function showActionMenu(event) {
    const menu = document.getElementById('action-menu');
    const button = event.target.closest('button');
    const rect = button.getBoundingClientRect();

    menu.style.display = 'block';
    menu.style.position = 'absolute';
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${rect.left}px`;

    // Close menu when clicking outside
    setTimeout(() => {
        const closeMenu = (e) => {
            if (!menu.contains(e.target) && !button.contains(e.target)) {
                menu.style.display = 'none';
                document.removeEventListener('click', closeMenu);
            }
        };
        document.addEventListener('click', closeMenu);
    }, 100);
}

// Add action
function addAction(actionType) {
    const actionId = `action-${actionIdCounter++}`;
    const actionList = document.getElementById('action-list');

    // Hide menu
    document.getElementById('action-menu').style.display = 'none';

    let actionHtml = '';

    if (actionType === 'set_field') {
        actionHtml = `
            <div class="action-item" id="${actionId}" data-type="set_field">
                <div class="action-item-header">
                    <h4><i class="fas fa-edit"></i> Set Field</h4>
                    <button type="button" class="btn-icon delete" onclick="removeAction('${actionId}')" title="Remove">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="action-item-body">
                    <div class="form-group">
                        <label>Field</label>
                        <select class="action-field" onchange="updateActionValueInput(this)">
                            <option value="">-- Select field --</option>
                            ${writableFields.map(f => `<option value="${f.value}">${f.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Value</label>
                        <div class="action-value-container">
                            <input type="text" class="action-value" placeholder="Enter value">
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else if (actionType === 'create_subtask') {
        actionHtml = `
            <div class="action-item" id="${actionId}" data-type="create_subtask">
                <div class="action-item-header">
                    <h4><i class="fas fa-tasks"></i> Create Subtask</h4>
                    <button type="button" class="btn-icon delete" onclick="removeAction('${actionId}')" title="Remove">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="action-item-body">
                    <div class="form-group">
                        <label>Task Text</label>
                        <input type="text" class="subtask-text" placeholder="Enter subtask description">
                    </div>
                    <div class="form-group">
                        <label>Assign To</label>
                        <select class="assignee-type" onchange="toggleAssigneeType(this)">
                            <option value="field">Use client field</option>
                            <option value="static">Specific person</option>
                        </select>
                    </div>
                    <div class="form-group assignee-field-group">
                        <label>Client Field</label>
                        <select class="assignee-field">
                            <option value="sales_team">Sales Team</option>
                            <option value="fulfillment_ops">Fulfillment Ops</option>
                        </select>
                    </div>
                    <div class="form-group assignee-static-group" style="display: none;">
                        <label>Person Name</label>
                        <select class="assignee-static">
                            <option value="">-- Select user --</option>
                            ${allUsers.map(user => `<option value="${user.name}">${user.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" class="mark-auto-created" checked>
                            <span>Mark as auto-created</span>
                        </label>
                    </div>
                </div>
            </div>
        `;
    }

    actionList.insertAdjacentHTML('beforeend', actionHtml);
}

// Remove action
function removeAction(actionId) {
    document.getElementById(actionId).remove();
}

// Update action value input based on selected field
function updateActionValueInput(fieldSelect) {
    const actionItem = fieldSelect.closest('.action-item');
    const container = actionItem.querySelector('.action-value-container');
    const selectedField = fieldSelect.value;

    // User fields that should use dropdown
    const userFields = ['fulfillment_ops', 'sales_team'];

    if (userFields.includes(selectedField)) {
        // Replace with user dropdown
        const currentValue = container.querySelector('.action-value')?.value || '';

        const userOptions = allUsers.map(user =>
            `<option value="${user.name}" ${user.name === currentValue ? 'selected' : ''}>${user.name}</option>`
        ).join('');

        container.innerHTML = `
            <select class="action-value">
                <option value="">-- Select user --</option>
                ${userOptions}
            </select>
        `;
    } else {
        // Use text input for non-user fields
        const currentValue = container.querySelector('.action-value')?.value || '';

        container.innerHTML = `
            <input type="text" class="action-value" placeholder="Enter value" value="${currentValue}">
        `;
    }
}

// Toggle assignee type (field vs static)
function toggleAssigneeType(select) {
    const actionItem = select.closest('.action-item');
    const fieldGroup = actionItem.querySelector('.assignee-field-group');
    const staticGroup = actionItem.querySelector('.assignee-static-group');

    if (select.value === 'field') {
        fieldGroup.style.display = 'block';
        staticGroup.style.display = 'none';
    } else {
        fieldGroup.style.display = 'none';
        staticGroup.style.display = 'block';
    }
}

// Save automation
async function saveAutomation() {
    try {
        // Collect basic info
        const name = document.getElementById('automation-name').value.trim();
        const description = document.getElementById('automation-description').value.trim();
        const trigger = document.getElementById('automation-trigger').value;
        const order = parseInt(document.getElementById('automation-order').value) || 0;
        const enabled = document.getElementById('automation-enabled').checked;

        // Validate
        if (!name || !trigger) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        // Build conditions
        const conditionMode = document.getElementById('condition-mode').value;
        let conditions;

        if (conditionMode === 'always') {
            conditions = { type: 'group', operator: 'AND', conditions: [] };
        } else {
            const rootGroup = document.getElementById('root-condition-group');
            const operator = rootGroup.dataset.operator;
            const conditionItems = Array.from(rootGroup.querySelectorAll('.condition-item'));

            const conditionsList = conditionItems.map(item => {
                const field = item.querySelector('.field-select').value;
                const op = item.querySelector('.operator-select').value;
                let value = item.querySelector('.value-input').value;

                if (!field) return null;

                // Parse value for array operators
                if (op === 'in' || op === 'not_in') {
                    try {
                        value = JSON.parse(value);
                    } catch (e) {
                        // Try to split by comma
                        value = value.split(',').map(v => v.trim());
                    }
                }

                return {
                    type: 'condition',
                    field: field,
                    operator: op,
                    value: value
                };
            }).filter(c => c !== null);

            conditions = {
                type: 'group',
                operator: operator,
                conditions: conditionsList
            };
        }

        // Build actions
        const actionItems = Array.from(document.querySelectorAll('.action-item'));
        const actions = actionItems.map(item => {
            const actionType = item.dataset.type;

            if (actionType === 'set_field') {
                return {
                    type: 'set_field',
                    field: item.querySelector('.action-field').value,
                    value: item.querySelector('.action-value').value
                };
            } else if (actionType === 'create_subtask') {
                const action = {
                    type: 'create_subtask',
                    text: item.querySelector('.subtask-text').value,
                    mark_auto_created: item.querySelector('.mark-auto-created').checked
                };

                const assigneeType = item.querySelector('.assignee-type').value;
                if (assigneeType === 'field') {
                    action.assignee_field = item.querySelector('.assignee-field').value;
                } else {
                    action.assignee_static = item.querySelector('.assignee-static').value;
                }

                return action;
            }
        });

        // Validate at least one action
        if (actions.length === 0) {
            showToast('Please add at least one action', 'error');
            updateWizardStep(3);
            return;
        }

        // Send to API (POST for create, PATCH for update)
        const isEditing = editingAutomationId !== null;
        const url = isEditing ? `/api/automations/${editingAutomationId}` : '/api/automations';
        const method = isEditing ? 'PATCH' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                name,
                description,
                trigger_event: trigger,
                conditions,
                actions,
                enabled,
                execution_order: order
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save automation');
        }

        showToast(isEditing ? 'Automation updated successfully!' : 'Automation created successfully!', 'success');
        closeAutomationModal();
        await loadAutomations();

    } catch (error) {
        console.error('Error saving automation:', error);
        showToast(error.message || 'Failed to save automation', 'error');
    }
}

// ==================== INITIALIZATION ====================

// Make functions globally accessible for onclick handlers
window.toggleTheme = toggleTheme;
window.switchTab = switchTab;
window.filterByStatus = filterByStatus;
window.filterCards = filterCards;
window.openNewRequestModal = openNewRequestModal;
window.closeModal = closeModal;
window.openClientDetail = openClientDetail;
window.logout = logout;
window.toggleAutomation = toggleAutomation;
// ==================== ACTIVITY LOGS ====================

let currentLogsPage = 0;
const logsPageSize = 100;

// Load activity logs
async function loadLogs() {
    try {
        // Get filter values
        const action = document.getElementById('log-filter-action')?.value || '';
        const userId = document.getElementById('log-filter-user')?.value || '';
        const startDate = document.getElementById('log-filter-start-date')?.value || '';
        const endDate = document.getElementById('log-filter-end-date')?.value || '';

        // Build query params
        const params = new URLSearchParams({
            limit: logsPageSize,
            offset: currentLogsPage * logsPageSize
        });

        if (action) params.append('action', action);
        if (userId) params.append('user_id', userId);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);

        const response = await fetch(`/api/logs?${params.toString()}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch logs');
        }

        const result = await response.json();
        renderLogs(result.data);

    } catch (error) {
        console.error('Error loading logs:', error);
        showToast('Failed to load activity logs', 'error');
    }
}

// Render logs table
function renderLogs(data) {
    const tbody = document.getElementById('logs-tbody');
    if (!tbody) return;

    if (data.logs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="padding: 40px; text-align: center; color: var(--text-tertiary);">
                    <i class="fas fa-inbox" style="font-size: 24px; margin-bottom: 12px;"></i>
                    <div>No activity logs found</div>
                </td>
            </tr>
        `;
        return;
    }

    // Action type labels and colors
    const actionTypes = {
        'client_created': { label: 'Client Created', color: '#4CAF50', icon: 'fa-plus-circle' },
        'client_updated': { label: 'Client Updated', color: '#2196F3', icon: 'fa-edit' },
        'client_deleted': { label: 'Client Deleted', color: '#F44336', icon: 'fa-trash' },
        'status_changed': { label: 'Status Changed', color: '#FF9800', icon: 'fa-exchange-alt' },
        'approval_changed': { label: 'Approval Changed', color: '#9C27B0', icon: 'fa-check-circle' },
        'subtask_created': { label: 'Subtask Created', color: '#00BCD4', icon: 'fa-tasks' },
        'subtask_toggled': { label: 'Subtask Toggled', color: '#3F51B5', icon: 'fa-check-square' },
        'subtask_assignee_changed': { label: 'Assignee Changed', color: '#795548', icon: 'fa-user' },
        'comment_added': { label: 'Comment Added', color: '#607D8B', icon: 'fa-comment' }
    };

    tbody.innerHTML = data.logs.map((log, index) => {
        const actionInfo = actionTypes[log.action] || { label: log.action, color: '#888', icon: 'fa-circle' };
        const timestamp = new Date(log.created_at).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        // Format details
        let detailsText = '';
        if (log.details) {
            if (log.action === 'client_updated' && log.details.fields_updated) {
                detailsText = `Fields: ${log.details.fields_updated.join(', ')}`;
            } else if (log.action === 'status_changed') {
                detailsText = `${log.details.old_status || 'N/A'} → ${log.details.new_status || 'N/A'}`;
            } else if (log.action === 'approval_changed') {
                detailsText = `Approval: ${log.details.approval || 'N/A'}`;
            } else if (log.action === 'subtask_created') {
                detailsText = log.details.subtask_text || 'Subtask created';
            } else if (log.action === 'subtask_toggled') {
                detailsText = log.details.completed ? 'Completed' : 'Uncompleted';
            } else if (log.action === 'comment_added') {
                detailsText = log.details.comment_text ? log.details.comment_text.substring(0, 50) + '...' : 'Comment added';
            }
        }

        return `
            <tr style="border-bottom: 1px solid var(--border-color); ${index % 2 === 0 ? 'background: var(--bg-elevated);' : ''}">
                <td style="padding: 12px; font-size: 13px; color: var(--text-secondary);">${timestamp}</td>
                <td style="padding: 12px; font-size: 14px; color: var(--text-primary);">${log.user_name || 'System'}</td>
                <td style="padding: 12px;">
                    <span style="
                        display: inline-block;
                        padding: 4px 12px;
                        border-radius: 12px;
                        font-size: 12px;
                        font-weight: 600;
                        background: ${actionInfo.color}22;
                        color: ${actionInfo.color};
                    ">
                        <i class="fas ${actionInfo.icon}" style="margin-right: 4px;"></i> ${actionInfo.label}
                    </span>
                </td>
                <td style="padding: 12px; font-size: 14px; color: var(--text-primary);">
                    ${log.client_code ? `${log.client_code} - ${log.client_name || ''}` : '--'}
                </td>
                <td style="padding: 12px; font-size: 13px; color: var(--text-secondary);">${detailsText || '--'}</td>
            </tr>
        `;
    }).join('');

    // Update pagination
    const showingCount = Math.min(data.offset + data.logs.length, data.total);
    document.getElementById('logs-showing-count').textContent = showingCount;
    document.getElementById('logs-total-count').textContent = data.total;

    const prevBtn = document.getElementById('logs-prev-btn');
    const nextBtn = document.getElementById('logs-next-btn');

    if (prevBtn) {
        prevBtn.disabled = currentLogsPage === 0;
        prevBtn.style.opacity = currentLogsPage === 0 ? '0.5' : '1';
        prevBtn.style.cursor = currentLogsPage === 0 ? 'not-allowed' : 'pointer';
    }

    if (nextBtn) {
        const hasMore = data.offset + data.logs.length < data.total;
        nextBtn.disabled = !hasMore;
        nextBtn.style.opacity = hasMore ? '1' : '0.5';
        nextBtn.style.cursor = hasMore ? 'pointer' : 'not-allowed';
    }
}

// Pagination functions
function previousLogsPage() {
    if (currentLogsPage > 0) {
        currentLogsPage--;
        loadLogs();
    }
}

function nextLogsPage() {
    currentLogsPage++;
    loadLogs();
}

// Clear filters
function clearLogFilters() {
    document.getElementById('log-filter-action').value = '';
    document.getElementById('log-filter-user').value = '';
    document.getElementById('log-filter-start-date').value = '';
    document.getElementById('log-filter-end-date').value = '';
    currentLogsPage = 0;
    loadLogs();
}

// Populate user filter dropdown
async function populateUserFilter() {
    try {
        const userSelect = document.getElementById('log-filter-user');
        if (!userSelect) return;

        // Use existing allUsers data if available
        if (window.allUsers && window.allUsers.length > 0) {
            const options = window.allUsers.map(user =>
                `<option value="${user.id}">${user.name}</option>`
            ).join('');
            userSelect.innerHTML = '<option value="">All Users</option>' + options;
        }
    } catch (error) {
        console.error('Error populating user filter:', error);
    }
}

// Export functions to window
window.loadLogs = loadLogs;
window.previousLogsPage = previousLogsPage;
window.nextLogsPage = nextLogsPage;
window.clearLogFilters = clearLogFilters;

window.deleteAutomation = deleteAutomation;
window.openAutomationModal = openAutomationModal;
window.editAutomation = editAutomation;
window.closeAutomationModal = closeAutomationModal;
window.nextWizardStep = nextWizardStep;
window.previousWizardStep = previousWizardStep;
window.toggleConditionMode = toggleConditionMode;
window.addCondition = addCondition;
window.removeCondition = removeCondition;
window.updateGroupOperator = updateGroupOperator;
window.updateConditionPreview = updateConditionPreview;
window.showActionMenu = showActionMenu;
window.addAction = addAction;
window.removeAction = removeAction;
window.toggleAssigneeType = toggleAssigneeType;
window.saveAutomation = saveAutomation;
window.handleFileSelect = handleFileSelect;
window.downloadAttachment = downloadAttachment;
window.deleteAttachment = deleteAttachment;

document.addEventListener('DOMContentLoaded', function() {
    console.log('Sincro Fulfillment Client App loaded');
    console.log('✅ toggleTheme function available:', typeof window.toggleTheme);

    // Initialize theme first (before loading data)
    initializeTheme();

    // Check authentication and load data
    checkAuth();
});
