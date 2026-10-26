package com.taskoura.service;

import com.taskoura.entity.Project;
import com.taskoura.entity.ProjectMember;
import com.taskoura.entity.Task;
import com.taskoura.entity.User;
import com.taskoura.exception.ForbiddenException;
import com.taskoura.exception.NotFoundException;
import com.taskoura.entity.Bug;
import com.taskoura.repository.BugRepository;
import com.taskoura.repository.ProjectMemberRepository;
import com.taskoura.repository.ProjectRepository;
import com.taskoura.repository.TaskRepository;
import com.taskoura.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class ProjectAccessService {

    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final BugRepository bugRepository;

    public ProjectAccessService(ProjectRepository projectRepository,
                                TaskRepository taskRepository,
                                UserRepository userRepository,
                                ProjectMemberRepository projectMemberRepository) {
        this(projectRepository, taskRepository, userRepository, projectMemberRepository, null);
    }

    @Autowired
    public ProjectAccessService(ProjectRepository projectRepository,
                                TaskRepository taskRepository,
                                UserRepository userRepository,
                                ProjectMemberRepository projectMemberRepository,
                                @Autowired(required = false) BugRepository bugRepository) {
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.bugRepository = bugRepository;
    }

    public Project requireMember(UUID projectId, String email) {
        Project project = getProjectOrThrow(projectId);
        String role = resolveRole(project, email);
        if (role == null) {
            throw new ForbiddenException("You are not a member of this project");
        }
        return project;
    }

    public Project requireOwner(UUID projectId, String email) {
        Project project = getProjectOrThrow(projectId);
        String role = resolveRole(project, email);
        if (role == null || !"Owner".equalsIgnoreCase(role)) {
            throw new ForbiddenException("Only the project owner has access");
        }
        return project;
    }

    public Task requireTaskAccess(UUID taskId, String email) {
        if (taskId == null) {
            throw new NotFoundException("Task not found");
        }
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new NotFoundException("Task not found"));
        if (task.getProject() == null) {
            throw new NotFoundException("Project not found");
        }
        requireMember(task.getProject().getId(), email);
        return task;
    }

    public Bug requireBugAccess(UUID bugId, String email) {
        if (bugId == null) {
            throw new NotFoundException("Bug not found");
        }
        if (bugRepository == null) {
            throw new IllegalStateException("BugRepository is not configured");
        }
        Bug bug = bugRepository.findById(bugId)
                .orElseThrow(() -> new NotFoundException("Bug not found"));
        if (bug.getTask() == null) {
            throw new NotFoundException("Task not found");
        }
        requireTaskAccess(bug.getTask().getId(), email);
        return bug;
    }

    public String getRole(UUID projectId, String email) {
        Project project = getProjectOrThrow(projectId);
        return resolveRole(project, email);
    }

    public Optional<String> findRole(UUID projectId, String email) {
        return Optional.ofNullable(getRole(projectId, email));
    }

    public String lookupRole(UUID projectId, String email) {
        return getRole(projectId, email);
    }

    public String getMembershipRole(UUID projectId, String email) {
        return getRole(projectId, email);
    }

    private Project getProjectOrThrow(UUID projectId) {
        if (projectId == null) {
            throw new NotFoundException("Project not found");
        }
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new NotFoundException("Project not found"));
    }

    private String resolveRole(Project project, String email) {
        if (email == null || email.isBlank()) {
            return null;
        }

        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return null;
        }

        boolean isDirectOwner = project.getOwner() != null &&
                (project.getOwner().getId().equals(user.getId()) ||
                 email.equalsIgnoreCase(project.getOwner().getEmail()));

        if (isDirectOwner) {
            return "Owner";
        }

        Optional<ProjectMember> memberOpt = projectMemberRepository.findByProjectIdAndUserId(project.getId(), user.getId());
        if (memberOpt.isPresent()) {
            String role = memberOpt.get().getRole();
            return role != null ? role : "Member";
        }

        return null;
    }
}
