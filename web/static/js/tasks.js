document.addEventListener('DOMContentLoaded', function() {
    const tasksList = document.querySelector('.tasks');
    let tg = window.Telegram.WebApp;

    function renderTasks(tasks) {
    tasksList.innerHTML = '';
    tasks.forEach(task => {
        const li = document.createElement('li');
        li.setAttribute('data-task-id', task.id);
        li.onclick = () => handleTaskClick(task);

        const completedClass = task.completed ? 'completed' : '';

        li.innerHTML = `
            <div class="task-content">
                <img src="${task.completed ? '/static/assets/tasks_done.png' : '/static/assets/tasks_rocket.png'}" alt="">
                <div class="task-info">
                    <h1>${task.title}</h1>
                    <p>Награда +${task.reward}</p>
                </div>
            </div>
            <img class="task-status" src="${task.completed ? '/static/assets/tasks_star.png' : '/static/assets/tasks_arrow.png'}" alt="">
        `;

        li.className = `task-item ${completedClass}`;

        tasksList.appendChild(li);
    });
}

    function handleTaskClick(task) {
        if (task.completed) return;

        tg.openTelegramLink(task.channel_link);

        setTimeout(() => {
            checkTask(task.id);
        }, 3000);
    }

    function checkTask(taskId) {
        fetch('/auth/check_task', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ taskId: taskId }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                tg.showAlert(`Поздравляем! Вы выполнили задание и получили ${data.reward} монет.`);
                updateTasksStatus();
            } else {
                tg.showAlert(data.message);
            }
        })
        .catch(error => {
            console.error('Ошибка при проверке задания:', error);
            tg.showAlert('Произошла ошибка при проверке задания. Попробуйте позже.');
        });
    }

    function updateTasksStatus() {
        fetch('/get_tasks_status')
        .then(response => response.json())
        .then(data => {
            renderTasks(data.tasks);
        })
        .catch(error => {
            console.error('Ошибка при обновлении статуса заданий:', error);
        });
    }


    setInterval(updateTasksStatus, 30000);


    updateTasksStatus();
});