from django.db import models
from django.utils import timezone

class Task(models.Model):
    name = models.CharField(max_length=255, help_text="Enter the task name or description.")
    completed = models.BooleanField(default=False, help_text="Is the task completed?")
    created_at = models.DateTimeField(auto_now_add=True, help_text="The time when the task was created.")
    updated_at = models.DateTimeField(auto_now=True, help_text="The time when the task was last updated.")

    def __str__(self):
        return f"{self.name}"