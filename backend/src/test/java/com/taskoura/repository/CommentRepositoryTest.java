package com.taskoura.repository;

import com.taskoura.entity.Comment;
import com.taskoura.entity.Project;
import com.taskoura.entity.Task;
import com.taskoura.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class CommentRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private CommentRepository commentRepository;

    private Task task;
    private User author;

    @BeforeEach
    void setUp() {
        author = entityManager.persistAndFlush(User.builder()
                .name("Comment Author")
                .email("comment-author@example.com")
                .passwordHash("hash")
                .verified(true)
                .build());

        Project project = entityManager.persistAndFlush(Project.builder()
                .name("Comment Project")
                .owner(author)
                .build());

        task = entityManager.persistAndFlush(Task.builder()
                .project(project)
                .title("Comment Target Task")
                .build());

        entityManager.clear();
    }

    @Test
    @DisplayName("findByTaskIdOrderByCreatedAtAsc returns comments ordered oldest first")
    void findByTaskIdOrderByCreatedAtAsc() {
        Comment c1 = Comment.builder()
                .task(task)
                .user(author)
                .content("First comment")
                .createdAt(LocalDateTime.now().minusMinutes(10))
                .build();

        Comment c2 = Comment.builder()
                .task(task)
                .user(author)
                .content("Second comment")
                .createdAt(LocalDateTime.now().minusMinutes(5))
                .build();

        commentRepository.save(c1);
        commentRepository.save(c2);
        entityManager.flush();
        entityManager.clear();

        List<Comment> comments = commentRepository.findByTaskIdOrderByCreatedAtAsc(task.getId());
        assertThat(comments).hasSize(2);
        assertThat(comments.get(0).getContent()).isEqualTo("First comment");
        assertThat(comments.get(1).getContent()).isEqualTo("Second comment");
    }
}
