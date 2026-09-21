package com.taskoura.repository;

import com.taskoura.entity.Project;
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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class ProjectRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private ProjectRepository projectRepository;

    private User userA;
    private User userB;

    @BeforeEach
    void setUp() {
        userA = User.builder()
                .name("User A")
                .email("usera-proj-test@example.com")
                .passwordHash("hashA")
                .verified(true)
                .build();
        userA = entityManager.persistAndFlush(userA);

        userB = User.builder()
                .name("User B")
                .email("userb-proj-test@example.com")
                .passwordHash("hashB")
                .verified(true)
                .build();
        userB = entityManager.persistAndFlush(userB);

        entityManager.clear();
    }

    @Test
    @DisplayName("save persists all fields and associates with owner")
    void save_persistsAllFields() {
        LocalDate deadline = LocalDate.now().plusMonths(2);
        Project project = Project.builder()
                .name("Alpha Project")
                .description("First project description")
                .frontendStack("React")
                .backendStack("Spring Boot")
                .databaseStack("PostgreSQL")
                .testingStack("JUnit 5")
                .owner(userA)
                .deadline(deadline)
                .build();

        Project saved = projectRepository.save(project);
        entityManager.flush();
        entityManager.clear();

        Project reloaded = entityManager.find(Project.class, saved.getId());
        assertThat(reloaded).isNotNull();
        assertThat(reloaded.getId()).isNotNull();
        assertThat(reloaded.getName()).isEqualTo("Alpha Project");
        assertThat(reloaded.getDescription()).isEqualTo("First project description");
        assertThat(reloaded.getFrontendStack()).isEqualTo("React");
        assertThat(reloaded.getBackendStack()).isEqualTo("Spring Boot");
        assertThat(reloaded.getDatabaseStack()).isEqualTo("PostgreSQL");
        assertThat(reloaded.getTestingStack()).isEqualTo("JUnit 5");
        assertThat(reloaded.getOwner().getId()).isEqualTo(userA.getId());
        assertThat(reloaded.getDeadline()).isEqualTo(deadline);
        assertThat(reloaded.getCreatedAt()).isNotNull();
    }

    @Test
    @DisplayName("findByOwnerId returns only projects belonging to that specific owner")
    void findByOwnerId_isolationBetweenUsers() {
        Project projA1 = Project.builder()
                .name("Project A1")
                .description("User A first project")
                .owner(userA)
                .deadline(LocalDate.now().plusDays(10))
                .build();
        Project projA2 = Project.builder()
                .name("Project A2")
                .description("User A second project")
                .owner(userA)
                .deadline(LocalDate.now().plusDays(20))
                .build();
        Project projB1 = Project.builder()
                .name("Project B1")
                .description("User B first project")
                .owner(userB)
                .deadline(LocalDate.now().plusDays(30))
                .build();

        entityManager.persist(projA1);
        entityManager.persist(projA2);
        entityManager.persist(projB1);
        entityManager.flush();
        entityManager.clear();

        List<Project> userAProjects = projectRepository.findByOwnerId(userA.getId());
        assertThat(userAProjects).hasSize(2);
        assertThat(userAProjects).extracting(Project::getName).containsExactlyInAnyOrder("Project A1", "Project A2");

        List<Project> userBProjects = projectRepository.findByOwnerId(userB.getId());
        assertThat(userBProjects).hasSize(1);
        assertThat(userBProjects.get(0).getName()).isEqualTo("Project B1");
    }

    @Test
    @DisplayName("findByOwnerId returns empty list when user has no projects")
    void findByOwnerId_noProjects_returnsEmptyList() {
        List<Project> projects = projectRepository.findByOwnerId(UUID.randomUUID());
        assertThat(projects).isEmpty();
    }
}
