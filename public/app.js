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
    const userAvatar = document.querySelector('.user-avatar');
    const userName = userAvatar.nextElementSibling;

    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
    userAvatar.textContent = initials;
    userName.textContent = user.name;

    if (user.picture) {
        userAvatar.style.backgroundImage = `url(${user.picture})`;
        userAvatar.style.backgroundSize = 'cover';
        userAvatar.textContent = '';
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
    // Clear all columns
    document.querySelectorAll('.column-cards').forEach(col => {
        col.innerHTML = '';
    });

    // Render each client in its appropriate column
    allClients.forEach(client => {
        const card = createClientCardElement(client);
        const targetColumn = document.querySelector(`.column[data-status="${client.status}"] .column-cards`);
        if (targetColumn) {
            targetColumn.appendChild(card);
        }
    });

    // Update column counts
    updateColumnCounts();
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
    card.className = `card ${client.status}`;
    card.draggable = true;
    card.setAttribute('data-id', client.id);
    card.setAttribute('data-client-data', JSON.stringify(client));
    card.ondragstart = drag;

    const formattedDate = new Date(client.est_inbound_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    // Approval badge
    let approvalBadge = '';
    if (client.auto_approved) {
        approvalBadge = '<span class="card-badge auto-approved"><i class="fas fa-check"></i> Auto-Approved</span>';
    } else if (client.status === 'new-request') {
        approvalBadge = '<span class="card-badge needs-review"><i class="fas fa-clock"></i> Needs Review</span>';
    }

    // Task badge
    const completedSubtasks = client.subtasks ? client.subtasks.filter(s => s.completed).length : 0;
    const totalSubtasks = client.subtasks ? client.subtasks.length : 0;
    let taskBadge = '';
    if (totalSubtasks > 0) {
        taskBadge = `<span class="card-badge"><i class="fas fa-tasks"></i> ${completedSubtasks}/${totalSubtasks}</span>`;
    }

    // Assignee avatars
    const salesInitials = getInitials(client.sales_team);
    const opsInitials = getInitials(client.fulfillment_ops);

    card.innerHTML = `
        <div class="card-id">${client.client_id}</div>
        <div class="card-title">${client.client_name}</div>
        <div class="card-meta">
            <span class="card-badge"><i class="fas fa-calendar"></i> ${formattedDate}</span>
            <span class="card-badge"><i class="fas fa-box"></i> ${client.client_type}</span>
            <span class="card-badge"><i class="fas fa-chart-line"></i> ${client.avg_orders}/mo</span>
            ${taskBadge}
            ${approvalBadge}
            <div class="assignee-group">
                <div class="card-assignee" title="Sales: ${client.sales_team}">${salesInitials}</div>
                <div class="card-assignee" title="Ops: ${client.fulfillment_ops}" style="background-color: #a29bfe; color: #6c5ce7;">${opsInitials}</div>
            </div>
        </div>
    `;

    card.addEventListener('click', function(e) {
        if (!isDragging) {
            openClientDetail(client.id);
        }
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

        console.log('Modal populated successfully');
    } catch (error) {
        console.error('Error in populateClientDetailModal:', error);
        throw error;
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

// Load comments into modal
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

        comments.forEach(comment => {
            const commentEl = document.createElement('div');
            commentEl.className = 'comment';

            const initials = getInitials(comment.user_name);
            const timeAgo = formatTimeAgo(new Date(comment.created_at));

            commentEl.innerHTML = `
                <div class="comment-avatar">${initials}</div>
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-author">${comment.user_name}</span>
                        <span class="comment-time">${timeAgo}</span>
                    </div>
                    <div class="comment-text">${highlightMentions(comment.comment_text)}</div>
                </div>
            `;

            commentBox.parentNode.insertBefore(commentEl, commentBox);
        });
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

// ==================== MENTION AUTOCOMPLETE ====================

// Highlight mentions in comment text
function highlightMentions(text) {
    // First escape HTML
    const escaped = escapeHtml(text);

    // Then wrap @mentions in span tags
    // Match @Username (letters, spaces, and common name characters)
    const mentionRegex = /@([A-Za-z][A-Za-z\s]*?)(?=\s|$|[^\w])/g;

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

    // Insert mention with @ symbol and add space after
    const newText = beforeMention + '@' + user.name + ' ' + afterCursor;
    textarea.value = newText;

    // Set cursor position after the mention
    const newCursorPos = beforeMention.length + user.name.length + 2; // +2 for @ and space
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

    // Regex to match @Username patterns
    const mentionRegex = /@([A-Za-z\s]+)(?=\s|$|[^\w])/g;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
        const mentionedName = match[1].trim();

        // Find user by name
        const user = allUsers.find(u => u.name === mentionedName);
        if (user && !mentionedUserIds.includes(user.id)) {
            mentionedUserIds.push(user.id);
        }
    }

    return mentionedUserIds;
}

// Add new comment
async function addComment() {
    if (!currentClientCard) return;

    const clientData = JSON.parse(currentClientCard.getAttribute('data-client-data'));
    const textarea = document.querySelector('.comment-box textarea');
    const commentText = textarea.value.trim();

    if (!commentText) {
        showToast('Please enter a comment', 'error');
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
                mentionedUsers
            })
        });

        if (!response.ok) {
            throw new Error('Failed to add comment');
        }

        textarea.value = '';
        showToast('Comment added', 'success');

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

function drag(event) {
    dragStartTime = Date.now();
    draggedCard = event.target.closest('.card');
    if (!draggedCard) return;

    setTimeout(() => {
        if (draggedCard) {
            isDragging = true;
            draggedCard.classList.add('dragging');
        }
    }, 50);

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/html', draggedCard.innerHTML);

    draggedCard.addEventListener('dragend', function() {
        this.classList.remove('dragging');
        setTimeout(() => {
            isDragging = false;
            draggedCard = null;
        }, 100);
    }, { once: true });
}

function allowDrop(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const columnCards = event.currentTarget;
    if (!columnCards.classList.contains('drag-over')) {
        columnCards.classList.add('drag-over');
    }
}

function dragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
}

async function drop(event) {
    event.preventDefault();
    const columnCards = event.currentTarget;
    columnCards.classList.remove('drag-over');

    if (draggedCard) {
        const newStatus = columnCards.closest('.column').getAttribute('data-status');
        const clientData = JSON.parse(draggedCard.getAttribute('data-client-data'));

        // Update status via API
        const success = await updateClientStatus(clientData.id, newStatus);

        if (success) {
            showToast(`Client moved to ${formatStatusName(newStatus)}`);
        }
    }
}

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

function updateColumnCounts() {
    document.querySelectorAll('.column').forEach(column => {
        const count = column.querySelectorAll('.card').length;
        column.querySelector('.column-count').textContent = count;
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

function filterCards() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const cards = document.querySelectorAll('.card');

    cards.forEach(card => {
        const title = card.querySelector('.card-title').textContent.toLowerCase();
        const id = card.querySelector('.card-id').textContent.toLowerCase();

        if (title.includes(searchTerm) || id.includes(searchTerm)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

function showAllCards() {
    document.getElementById('searchInput').value = '';
    document.querySelectorAll('.card').forEach(card => {
        card.style.display = 'block';
    });
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

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Sincro Fulfillment Client App loaded');
    checkAuth(); // Check authentication and load data
});
