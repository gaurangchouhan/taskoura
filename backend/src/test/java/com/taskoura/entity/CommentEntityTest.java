package com.taskoura.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CommentEntityTest {

    @Test
    @DisplayName("Comment builder sets defaults and fields properly")
    void commentBuilder() {
        Task task = Task.builder().id(UUID.randomUUID()).title("Task").build();
        User user = User.builder().id(UUID.randomUUID()).name("Author").email("author@example.com").build();
        UUID commentId = UUID.randomUUID();

        Comment comment = Comment.builder()
                .id(commentId)
                .task(task)
                .user(user)
                .content("This is a detailed comment about the implementation.")
                .build();

        assertThat(comment.getId()).isEqualTo(commentId);
        assertThat(comment.getTask()).isEqualTo(task);
        assertThat(comment.getUser()).isEqualTo(user);
        assertThat(comment.getContent()).isEqualTo("This is a detailed comment about the implementation.");
        assertThat(comment.getCreatedAt()).isNotNull();
    }

    @Test
    @DisplayName("Comment setters work")
    void commentSetters() {
        Comment comment = new Comment();
        UUID id = UUID.randomUUID();
        LocalDateTime now = LocalDateTime.now();

        comment.setId(id);
        comment.setContent("Updated content");
        comment.setCreatedAt(now);

        assertThat(comment.getId()).isEqualTo(id);
        assertThat(comment.getContent()).isEqualTo("Updated content");
        assertThat(comment.getCreatedAt()).isEqualTo(now);
    }
}
