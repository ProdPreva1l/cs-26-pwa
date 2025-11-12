from django.conf import settings
from django.db import models


class Priority(models.IntegerChoices):
    LOW = 0, "Low"
    MEDIUM = 1, "Medium"
    HIGH = 2, "High"
    URGENT = 3, "Urgent"


class Status(models.IntegerChoices):
    TODO = 0, "To Do"
    IN_PROGRESS = 1, "In Progress"
    IN_REVIEW = 2, "In Review"
    COMPLETE = 3, "Complete"


class OwnedObject(models.Model):
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(class)s_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Task(OwnedObject):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    status = models.IntegerField(choices=Status.choices, default=Status.TODO)
    priority = models.IntegerField(choices=Priority.choices, default=Priority.LOW)

    def __str__(self):
        return self.title


class Comment(OwnedObject):
    content = models.TextField()
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="comments",
    )

    def __str__(self):
        author = self.author or "Anonymous"
        return f"Comment by {author} on {self.task}"
