from django.shortcuts import render, get_object_or_404
from django import forms
from django.http import HttpResponseRedirect, JsonResponse, HttpResponseNotAllowed, HttpResponse
from django.urls import reverse
from django.views.decorators.http import require_GET
from django.views.decorators.csrf import csrf_exempt
import json

from .models import Task, Status, Priority

# Form class for adding a new task
class NewTaskForm(forms.Form):
    task = forms.CharField(
        label='',
        widget=forms.TextInput(attrs={
            'autofocus': 'autofocus',
            'id': 'task',
            'placeholder': 'New Task'
        })
    )

# Index View - Home page showing task list
def index(request):
    # Fetch all tasks from the database to display them
    tasks = Task.objects.all()
    return render(request, "tasks/index.html", {
        "tasks": tasks  # Pass tasks to the template
    })

# Add View - Adding a new task via form
def add(request):
    if request.method == "POST":
        form = NewTaskForm(request.POST)
        if form.is_valid():
            task_title = form.cleaned_data["task"]
            description = request.POST.get("description", "")
            priority = request.POST.get("priority", Priority.LOW)
            status = request.POST.get("status", Status.TODO)

            user = request.user
            if not user.is_authenticated:
                return HttpResponseRedirect(reverse("login"))

            Task.objects.create(
                title=task_title,
                description=description,
                priority=int(priority),
                status=int(status),
                author=user
            )
            return HttpResponseRedirect(reverse("tasks:index"))
        else:
            return render(request, "tasks/add.html", {
                "form": form
            })
    return render(request, "tasks/add.html", {
        "form": NewTaskForm()
    })


# API View to Get a List of Tasks
def get_tasks(request):
    tasks = Task.objects.all().values("id", "title", "description", "priority", "status")
    return JsonResponse(list(tasks), safe=False)


# API View to Get a Specific Task
def get_task(request, id):
    task = get_object_or_404(Task, id=id)
    return JsonResponse({
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "priority": task.priority
    })


# API View to Create a New Task
@csrf_exempt
def create_task(request):
    if request.method == "POST":
        data = json.loads(request.body)
        task_title = data.get("task") or data.get("title")

        if task_title:
            # Check if task already exists
            if Task.objects.filter(title=task_title).exists():
                return JsonResponse({"error": "Task already exists."}, status=400)

            task = Task.objects.create(
                title=task_title,
                description=data.get("description", ""),
                priority=data.get("priority", Priority.LOW),
                status=data.get("status", Status.TODO),
                author=request.user if request.user.is_authenticated else None
            )

            return JsonResponse({
                "message": "Task added successfully",
                "task": {
                    "id": task.id,
                    "title": task.title,
                    "description": task.description,
                    "priority": task.priority,
                    "status": task.status
                }
            }, status=201)
        else:
            return JsonResponse({"error": "Task content not provided."}, status=400)
    return HttpResponseNotAllowed(["POST"])

# API View to Update a Task
@csrf_exempt
def update_task(request, id):
    if request.method in ["PUT", "PATCH"]:
        task = get_object_or_404(Task, id=id)
        data = json.loads(request.body)

        # Update fields if provided
        if "title" in data:
            task.title = data["title"]
        if "description" in data:
            task.description = data["description"]
        if "status" in data:
            task.status = data["status"]
        if "priority" in data:
            task.priority = data["priority"]

        task.save()

        return JsonResponse({
            "message": "Task updated successfully",
            "task": {
                "id": task.id,
                "title": task.title,
                "description": task.description,
                "priority": task.priority,
                "status": task.status
            }
        })

    return HttpResponseNotAllowed(["PUT", "PATCH"])

# API View to Delete a Task
@csrf_exempt
def delete_task(request, id):
    if request.method == "DELETE":
        task = get_object_or_404(Task, id=id)
        task.delete()
        return JsonResponse({"message": "Task deleted successfully."})
    return HttpResponseNotAllowed(["DELETE"])

@require_GET
def serve_service_worker(request):
    with open('static/service-worker.js', 'r') as file:
        response = HttpResponse(file.read(), content_type='application/javascript')
        return response