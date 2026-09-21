package com.taskoura.service;

import com.taskoura.dto.BugDtos.CreateBugRequest;
import com.taskoura.dto.BugDtos.BugResponse;
import com.taskoura.entity.Bug;
import com.taskoura.entity.Task;
import com.taskoura.entity.User;
import com.taskoura.exception.NotFoundException;
import com.taskoura.repository.BugRepository;
import com.taskoura.repository.TaskRepository;
import com.taskoura.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class BugService {

    private final BugRepository bugRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    public BugService(BugRepository bugRepository, TaskRepository taskRepository, UserRepository userRepository) {
        this.bugRepository = bugRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
    }

    public BugResponse createBug(UUID taskId, CreateBugRequest request, String userEmail) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new NotFoundException("Task not found"));

        User reporter = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new NotFoundException("User not found"));

        User assignee = null;
        if (request.assignedTo() != null) {
            assignee = userRepository.findById(request.assignedTo())
                    .orElseThrow(() -> new NotFoundException("Assigned user not found"));
        }

        Bug bug = Bug.builder()
                .task(task)
                .reportedBy(reporter)
                .assignedTo(assignee)
                .description(request.description())
                .severity(request.severity())
                .status("Open")
                .build();

        Bug saved = bugRepository.save(bug);
        return toResponse(saved);
    }

    public BugResponse resolveBug(UUID bugId) {
        Bug bug = bugRepository.findById(bugId)
                .orElseThrow(() -> new NotFoundException("Bug not found"));

        bug.setStatus("Resolved");
        bug.setResolvedAt(LocalDateTime.now());

        Bug saved = bugRepository.save(bug);
        return toResponse(saved);
    }

    public List<BugResponse> getBugsForTask(UUID taskId) {
        if (!taskRepository.existsById(taskId)) {
            throw new NotFoundException("Task not found");
        }

        return bugRepository.findByTaskIdOrderByCreatedAtAsc(taskId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private BugResponse toResponse(Bug bug) {
        return new BugResponse(
                bug.getId(),
                bug.getTask().getId(),
                bug.getSeverity(),
                bug.getStatus(),
                bug.getReportedBy().getId(),
                bug.getAssignedTo() != null ? bug.getAssignedTo().getId() : null,
                bug.getCreatedAt(),
                bug.getResolvedAt()
        );
    }
}
