from django.urls import path

from tasks import views

urlpatterns = [
    path("", views.index, name="index"),
    path("add", views.add, name="add"),
    path("api/tasks/", views.get_tasks, name="get_tasks"),
    path("api/tasks/<int:id>/", views.get_task, name="get_task"),
    path("api/tasks/create/", views.create_task, name="create_task"),
    path("api/tasks/update/<int:id>/", views.update_task, name="update_task"),
    path("api/tasks/delete/<int:id>/", views.delete_task, name="delete_task"),
]