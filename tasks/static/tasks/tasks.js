const Priority = Object.freeze({
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2,
    URGENT: 3,
});

const Status = Object.freeze({
    TODO: 0,
    IN_PROGRESS: 1,
    IN_REVIEW: 2,
    COMPLETE: 3,
});

const PriorityLabels = {
    0: 'Low',
    1: 'Medium',
    2: 'High',
    3: 'Urgent'
};

const StatusLabels = {
    0: 'To Do',
    1: 'In Progress',
    2: 'In Review',
    3: 'Complete'
};

function getCSRFToken() {
    let cookieValue = null;
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.startsWith('csrftoken=')) {
            cookieValue = cookie.substring('csrftoken='.length, cookie.length);
            break;
        }
    }
    return cookieValue;
}

document.addEventListener('DOMContentLoaded', function () {
    initializeIndexedDB();
    loadTaskList();
    createEditModal();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(function (registration) {
            registration.active.postMessage({csrfToken: getCSRFToken()});
        });
    }
});

function createEditModal() {
    const modalHTML = `
        <div id="editModal" class="modal">
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>Edit Task</h2>
                <form id="editTaskForm">
                    <input type="hidden" id="editTaskId">
                    <div class="form-group">
                        <label for="editTaskTitle">Title:</label>
                        <input type="text" id="editTaskTitle" required>
                    </div>
                    <div class="form-group">
                        <label for="editTaskDescription">Description:</label>
                        <textarea id="editTaskDescription" rows="4"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="editTaskPriority">Priority:</label>
                        <select id="editTaskPriority">
                            <option value="0">Low</option>
                            <option value="1">Medium</option>
                            <option value="2">High</option>
                            <option value="3">Urgent</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="editTaskStatus">Status:</label>
                        <select id="editTaskStatus">
                            <option value="0">To Do</option>
                            <option value="1">In Progress</option>
                            <option value="2">In Review</option>
                            <option value="3">Complete</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn-delete">Delete</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById('editModal');
    const closeBtn = modal.querySelector('.close');
    const deleteBtn = modal.querySelector('.btn-delete');

    closeBtn.onclick = () => {
        saveTaskEdit();
        modal.style.display = 'none';
    };

    window.onclick = (event) => {
        if (event.target === modal) {
            saveTaskEdit();
            modal.style.display = 'none';
        }
    };

    deleteBtn.onclick = () => {
        if (confirm('Are you sure you want to delete this task?')) {
            deleteTask();
        }
    };
}

function openEditModal(task) {
    // Get the current task card to read the most up-to-date values
    const taskCard = document.querySelector(`[data-task-id="${task.id}"]`);

    if (taskCard) {
        // Read current values from the DOM
        const currentStatus = parseInt(taskCard.closest('.task-list').dataset.status);
        const currentPriority = parseInt(taskCard.dataset.priority);
        const currentTitle = taskCard.querySelector('.task-label').textContent;
        const currentDescription = task.description || ''; // Description comes from task object

        document.getElementById('editTaskId').value = task.id;
        document.getElementById('editTaskTitle').value = currentTitle;
        document.getElementById('editTaskDescription').value = currentDescription;
        document.getElementById('editTaskPriority').value = currentPriority;
        document.getElementById('editTaskStatus').value = currentStatus;
    } else {
        // Fallback to task object if card not found
        document.getElementById('editTaskId').value = task.id;
        document.getElementById('editTaskTitle').value = task.title;
        document.getElementById('editTaskDescription').value = task.description || '';
        document.getElementById('editTaskPriority').value = task.priority;
        document.getElementById('editTaskStatus').value = task.status;
    }

    document.getElementById('editModal').style.display = 'block';
}

function saveTaskEdit() {
    const taskId = document.getElementById('editTaskId').value;
    const newTitle = document.getElementById('editTaskTitle').value;

    // Don't save if title is empty
    if (!newTitle.trim()) {
        return;
    }

    const newDescription = document.getElementById('editTaskDescription').value;
    const newPriority = parseInt(document.getElementById('editTaskPriority').value);
    const newStatus = parseInt(document.getElementById('editTaskStatus').value);

    const updatedTask = {
        id: taskId,
        title: newTitle,
        description: newDescription,
        priority: newPriority,
        status: newStatus
    };

    submitTaskToServer(updatedTask, true);

    // Update the task card immediately in the UI
    const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
    if (taskCard) {
        const oldStatus = parseInt(taskCard.closest('.task-list').dataset.status);
        const oldPriority = parseInt(taskCard.dataset.priority);

        // Update the task card title
        taskCard.querySelector('.task-label').textContent = newTitle;

        // Update description in dataset and metadata display
        taskCard.dataset.description = newDescription;

        let metaText = taskCard.querySelector('.task-meta');
        const metaContainer = taskCard.querySelector('.task-meta-container');

        if (newDescription) {
            const truncatedDesc = newDescription.substring(0, 50) + (newDescription.length > 50 ? '...' : '');
            if (metaText) {
                metaText.textContent = truncatedDesc;
            } else {
                // Create meta text if it doesn't exist
                metaText = document.createElement('span');
                metaText.className = 'task-meta';
                metaText.textContent = truncatedDesc;
                metaContainer.appendChild(metaText);
            }
        } else {
            // Remove meta text if description is empty
            if (metaText) {
                metaText.remove();
            }
        }

        // Update priority class and badge
        taskCard.classList.remove(`priority-${oldPriority}`);
        taskCard.classList.add(`priority-${newPriority}`);
        taskCard.dataset.priority = newPriority;

        const priorityBadge = taskCard.querySelector('.priority-badge');
        if (priorityBadge) {
            priorityBadge.textContent = PriorityLabels[newPriority];
        }

        // If status or priority changed, move the card
        if (oldStatus !== newStatus || oldPriority !== newPriority) {
            taskCard.remove();
            const newTaskList = document.querySelector(`.task-list[data-status="${newStatus}"]`);
            if (newTaskList) {
                insertTaskInPriorityOrder(newTaskList, taskCard, newPriority);
            }
        } else if (oldPriority !== newPriority) {
            // Just reorder within the same column
            const taskList = taskCard.closest('.task-list');
            taskCard.remove();
            insertTaskInPriorityOrder(taskList, taskCard, newPriority);
        }
    }
}

function deleteTask() {
    const taskId = document.getElementById('editTaskId').value;

    if (!navigator.onLine) {
        alert('Cannot delete task while offline');
        return;
    }

    fetch(`api/tasks/delete/${taskId}/`, {
        method: 'DELETE',
        headers: {
            'X-CSRFToken': getCSRFToken()
        }
    })
    .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        console.log('Task deleted successfully');
        document.getElementById('editModal').style.display = 'none';
        loadTaskList();
    })
    .catch(error => {
        console.error('Failed to delete task:', error);
        alert('Failed to delete task');
    });
}

function loadTaskList() {
    if (!navigator.onLine) {
        console.warn("Offline mode detected. Loading tasks from IndexedDB.");
        loadTasksFromIndexedDB();
    } else {
        fetch('api/tasks/')
            .then(response => response.json())
            .then(tasks => {
                clearAllColumns();
                tasks.forEach(task => addTaskToPage(task));
            })
            .catch(error => {
                console.error("Failed to load task list from server:", error);
                loadTasksFromIndexedDB();
            });
    }
}

function loadTasksFromIndexedDB() {
    const request = indexedDB.open("tasksDB", 1);
    request.onsuccess = function (event) {
        const db = event.target.result;
        const transaction = db.transaction(["tasks"], "readonly");
        const objectStore = transaction.objectStore("tasks");
        const tasks = [];
        objectStore.openCursor().onsuccess = function (event) {
            const cursor = event.target.result;
            if (cursor) {
                tasks.push(cursor.value);
                cursor.continue();
            } else {
                clearAllColumns();
                tasks.forEach(task => addTaskToPage(task));
            }
        };
    };
    request.onerror = function (event) {
        console.error("IndexedDB error:", event.target.errorCode);
    };
}

function initializeIndexedDB() {
    const request = indexedDB.open("tasksDB", 1);
    request.onupgradeneeded = function (event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("tasks")) {
            db.createObjectStore("tasks", {keyPath: "id", autoIncrement: true});
        }
    };
    request.onerror = function (event) {
        console.error("IndexedDB initialization error:", event.target.errorCode);
    };
}

function clearAllColumns() {
    document.querySelectorAll('.task-list').forEach(list => {
        list.innerHTML = '';
    });
}

function addTaskToPage(task) {
    const status = task.status !== undefined ? task.status : Status.TODO;
    const priority = task.priority !== undefined ? task.priority : Priority.LOW;

    const taskList = document.querySelector(`.task-list[data-status="${status}"]`);

    if (!taskList) {
        console.error(`Task list not found for status ${status}`);
        return;
    }

    const taskCard = document.createElement('div');
    taskCard.className = 'task-card';
    taskCard.classList.add(`priority-${priority}`);
    taskCard.draggable = true;
    taskCard.dataset.taskId = task.id;
    taskCard.dataset.priority = priority;
    taskCard.dataset.description = task.description || ''; // Store description in dataset

    const taskContent = document.createElement('div');
    taskContent.className = 'task-content';

    const label = document.createElement('span');
    label.className = 'task-label';
    label.textContent = task.title || task.name;

    taskContent.appendChild(label);

    // Add metadata section
    const metaContainer = document.createElement('div');
    metaContainer.className = 'task-meta-container';

    const priorityBadge = document.createElement('span');
    priorityBadge.className = 'task-badge priority-badge';
    priorityBadge.textContent = PriorityLabels[priority];

    const metaText = document.createElement('span');
    metaText.className = 'task-meta';
    if (task.description) {
        metaText.textContent = task.description.substring(0, 50) + (task.description.length > 50 ? '...' : '');
    }

    metaContainer.appendChild(priorityBadge);
    if (task.description) {
        metaContainer.appendChild(metaText);
    }

    taskCard.appendChild(taskContent);
    taskCard.appendChild(metaContainer);

    // Click to edit
    taskCard.addEventListener('click', (e) => {
        // Don't open modal if currently dragging
        if (!taskCard.classList.contains('dragging')) {
            openEditModal({
                id: task.id,
                title: task.title || task.name,
                description: taskCard.dataset.description,
                priority: priority,
                status: status
            });
        }
    });

    // Drag and drop event listeners
    taskCard.addEventListener('dragstart', handleDragStart);
    taskCard.addEventListener('dragend', handleDragEnd);

    // Insert task in priority order (higher priority first)
    insertTaskInPriorityOrder(taskList, taskCard, priority);
}

function insertTaskInPriorityOrder(taskList, taskCard, priority) {
    const existingTasks = Array.from(taskList.children);

    // Find the correct position based on priority (higher priority = lower number = earlier in list)
    let insertIndex = existingTasks.findIndex(existingTask => {
        const existingPriority = parseInt(existingTask.dataset.priority);
        return priority > existingPriority; // Insert before lower priority tasks
    });

    if (insertIndex === -1) {
        // No lower priority task found, append to end
        taskList.appendChild(taskCard);
    } else {
        // Insert before the lower priority task
        taskList.insertBefore(taskCard, existingTasks[insertIndex]);
    }
}

// Drag and drop handlers
let draggedTask = null;
let draggedTaskData = null;

function handleDragStart(e) {
    draggedTask = this;
    draggedTaskData = {
        taskId: this.dataset.taskId,
        title: this.querySelector('.task-label').textContent,
        priority: parseInt(this.dataset.priority),
        currentStatus: parseInt(this.closest('.task-list').dataset.status)
    };

    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragEnd(_) {
    this.classList.remove('dragging');
    document.querySelectorAll('.task-list').forEach(list => {
        list.classList.remove('drag-over');
    });
    draggedTask = null;
    draggedTaskData = null;
}

// Add drag over handlers to columns
document.querySelectorAll('.task-list').forEach(taskList => {
    taskList.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this.classList.add('drag-over');
        return false;
    });

    taskList.addEventListener('dragleave', function(_) {
        this.classList.remove('drag-over');
    });

    taskList.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();

        this.classList.remove('drag-over');

        if (draggedTask && draggedTaskData) {
            const newStatus = parseInt(this.dataset.status);
            const oldStatus = draggedTaskData.currentStatus;

            // Only process if status actually changed
            if (newStatus !== oldStatus) {
                // Remove from old column
                draggedTask.remove();

                // Update the task card's dataset
                draggedTask.dataset.status = newStatus;

                // Insert in priority order in new column
                const priority = draggedTaskData.priority;
                insertTaskInPriorityOrder(this, draggedTask, priority);

                // Update task data and submit to server
                const taskData = {
                    id: draggedTaskData.taskId,
                    title: draggedTaskData.title,
                    priority: priority,
                    status: newStatus,
                    description: draggedTask.dataset.description || ''
                };

                submitTaskToServer(taskData, true);
            }
        }

        return false;
    });
});

function submitTaskToServer(task, isUpdate = false) {
    if (!navigator.onLine) {
        console.warn("Offline mode detected. Saving task to IndexedDB for later sync.");
        saveTask(task);
        registerSync();
        return;
    }

    const url = isUpdate ? `api/tasks/update/${task.id}/` : 'api/tasks/create/';
    const method = isUpdate ? 'PUT' : 'POST';

    // Prepare body data based on whether it's an update or create
    const bodyData = isUpdate ? {
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        status: task.status
    } : {
        task: task.title,
        priority: task.priority || Priority.LOW,
        status: task.status || Status.TODO
    };

    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        body: JSON.stringify(bodyData)
    })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            console.log(`Task successfully ${isUpdate ? 'updated on' : 'sent to'} server`);
            return response.json();
        })
        .then(data => {
            console.log("Server response:", data);
            if (!isUpdate && data.task) {
                // Add the newly created task to the page
                addTaskToPage(data.task);
            }
        })
        .catch(error => {
            console.error(`Failed to ${isUpdate ? 'update' : 'send'} task to server:`, error);
            saveTask(task);
            registerSync();
        });
}

function registerSync() {
    if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
        navigator.serviceWorker.ready.then(function (registration) {
            return registration.sync.register('sync-tasks');
        }).then(() => {
            console.log('Sync registered for tasks');
        }).catch(err => {
            console.log('Sync registration failed:', err);
        });
    }
}

function saveTask(task) {
    const request = indexedDB.open("tasksDB", 1);
    request.onsuccess = function (event) {
        const db = event.target.result;
        const transaction = db.transaction(["tasks"], "readwrite");
        const objectStore = transaction.objectStore("tasks");

        // Use put instead of add to update existing tasks
        objectStore.put(task);
        console.log("Task saved to IndexedDB for offline sync");
    };
    request.onerror = function (event) {
        console.error("Error saving task to IndexedDB:", event.target.errorCode);
    };
}