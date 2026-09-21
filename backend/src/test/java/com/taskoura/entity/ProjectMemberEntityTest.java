package com.taskoura.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ProjectMemberEntityTest {

    @Test
    @DisplayName("ProjectMember builder and getters work properly")
    void projectMemberBuilder() {
        Project project = Project.builder().id(UUID.randomUUID()).name("Test Project").build();
        User user = User.builder().id(UUID.randomUUID()).name("Member Name").email("member@example.com").build();
        UUID id = UUID.randomUUID();

        ProjectMember member = ProjectMember.builder()
                .id(id)
                .project(project)
                .user(user)
                .role("Owner")
                .build();

        assertThat(member.getId()).isEqualTo(id);
        assertThat(member.getProject()).isEqualTo(project);
        assertThat(member.getUser()).isEqualTo(user);
        assertThat(member.getRole()).isEqualTo("Owner");
    }

    @Test
    @DisplayName("ProjectMember no-args constructor and setters work")
    void projectMemberNoArgsAndSetters() {
        ProjectMember member = new ProjectMember();
        Project project = new Project();
        User user = new User();
        UUID id = UUID.randomUUID();

        member.setId(id);
        member.setProject(project);
        member.setUser(user);
        member.setRole("Member");

        assertThat(member.getId()).isEqualTo(id);
        assertThat(member.getProject()).isEqualTo(project);
        assertThat(member.getUser()).isEqualTo(user);
        assertThat(member.getRole()).isEqualTo("Member");
    }
}
