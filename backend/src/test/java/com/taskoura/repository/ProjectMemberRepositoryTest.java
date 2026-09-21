package com.taskoura.repository;

import com.taskoura.entity.Project;
import com.taskoura.entity.ProjectMember;
import com.taskoura.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class ProjectMemberRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private ProjectMemberRepository projectMemberRepository;

    private User owner;
    private User memberUser;
    private Project project;

    @BeforeEach
    void setUp() {
        owner = User.builder()
                .name("Owner User")
                .email("owner-mem-test@example.com")
                .passwordHash("hash")
                .verified(true)
                .build();
        owner = entityManager.persistAndFlush(owner);

        memberUser = User.builder()
                .name("Member User")
                .email("member-mem-test@example.com")
                .passwordHash("hash")
                .verified(true)
                .build();
        memberUser = entityManager.persistAndFlush(memberUser);

        project = Project.builder()
                .name("Membership Project")
                .description("Desc")
                .owner(owner)
                .deadline(LocalDate.now().plusMonths(1))
                .build();
        project = entityManager.persistAndFlush(project);

        entityManager.clear();
    }

    @Test
    @DisplayName("save and findByProjectId returns members")
    void saveAndFindByProjectId() {
        ProjectMember member = ProjectMember.builder()
                .project(project)
                .user(memberUser)
                .role("Member")
                .build();

        ProjectMember saved = projectMemberRepository.save(member);
        entityManager.flush();
        entityManager.clear();

        List<ProjectMember> members = projectMemberRepository.findByProjectId(project.getId());
        assertThat(members).hasSize(1);
        assertThat(members.get(0).getId()).isEqualTo(saved.getId());
        assertThat(members.get(0).getRole()).isEqualTo("Member");
        assertThat(members.get(0).getUser().getEmail()).isEqualTo("member-mem-test@example.com");
    }

    @Test
    @DisplayName("findByProjectIdAndUserId and existsByProjectIdAndUserId work as expected")
    void findAndExistsByProjectIdAndUserId() {
        ProjectMember member = ProjectMember.builder()
                .project(project)
                .user(memberUser)
                .role("Member")
                .build();
        entityManager.persistAndFlush(member);
        entityManager.clear();

        Optional<ProjectMember> found = projectMemberRepository.findByProjectIdAndUserId(project.getId(), memberUser.getId());
        assertThat(found).isPresent();
        assertThat(found.get().getRole()).isEqualTo("Member");

        boolean exists = projectMemberRepository.existsByProjectIdAndUserId(project.getId(), memberUser.getId());
        assertThat(exists).isTrue();

        boolean notExists = projectMemberRepository.existsByProjectIdAndUserId(project.getId(), owner.getId());
        assertThat(notExists).isFalse();
    }

    @Test
    @DisplayName("unique constraint on (project_id, user_id) rejects duplicate entry")
    void duplicateMembership_throwsException() {
        ProjectMember first = ProjectMember.builder()
                .project(project)
                .user(memberUser)
                .role("Member")
                .build();
        entityManager.persistAndFlush(first);

        ProjectMember duplicate = ProjectMember.builder()
                .project(project)
                .user(memberUser)
                .role("Owner")
                .build();

        assertThrows(Exception.class, () -> {
            entityManager.persistAndFlush(duplicate);
        });
    }

    @Test
    @DisplayName("delete removes member from repository")
    void deleteMember_removesFromRepository() {
        ProjectMember member = ProjectMember.builder()
                .project(project)
                .user(memberUser)
                .role("Member")
                .build();
        ProjectMember saved = entityManager.persistAndFlush(member);
        entityManager.clear();

        projectMemberRepository.deleteById(saved.getId());
        entityManager.flush();
        entityManager.clear();

        assertThat(projectMemberRepository.findByProjectId(project.getId())).isEmpty();
    }
}
