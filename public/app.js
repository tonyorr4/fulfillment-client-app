// Sincro Fulfillment Client App - Frontend JavaScript
// Connects to backend API

// ==================== GLOBAL STATE ====================
let currentUser = null;
let allClients = [];
let allUsers = []; // All approved users for assignee dropdown
let currentClientCard = null;
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

// Render all clients on the board
function renderAllClients() {
    const cardGrid = document.getElementById('cardGrid');
    if (!cardGrid) {
        console.error('Card grid container not found');
        return;
    }

    // Clear the grid
    cardGrid.innerHTML = '';

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

        // Store current client card reference
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

    // Re-render comments
    if (currentClientCard) {
        const clientData = JSON.parse(currentClientCard.getAttribute('data-client-data'));
        loadCommentsIntoModal(clientData.comments || []);
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

// Search filter
function filterCards() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const cards = document.querySelectorAll('.card');

    cards.forEach(card => {
        const cardName = card.querySelector('.card-name').textContent.toLowerCase();
        const cardId = card.querySelector('.card-id').textContent.toLowerCase();

        if (cardName.includes(searchTerm) || cardId.includes(searchTerm)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
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
        { id: 'detailEmail', key: 'client_email', type: 'input', inputType: 'email' },
        { id: 'detailClientType', key: 'client_type', type: 'select', options: ['eFulfillment', '3PL', 'Hybrid'] },
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

        const currentValue = el.textContent;

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

// Open automation modal (placeholder for now)
function openAutomationModal() {
    alert('Automation builder coming soon! For now, automations are managed via the database.\n\nDefault automations have been created:\n- Auto-assign Ian to fulfillment ops\n- Auto-approve simple clients\n- Create client setup subtasks');
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

document.addEventListener('DOMContentLoaded', function() {
    console.log('Sincro Fulfillment Client App loaded');
    console.log('✅ toggleTheme function available:', typeof window.toggleTheme);

    // Initialize theme first (before loading data)
    initializeTheme();

    // Check authentication and load data
    checkAuth();
});
