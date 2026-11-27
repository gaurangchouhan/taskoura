package com.taskoura.repository;

import com.taskoura.dto.UserAvatarProjection;
import com.taskoura.entity.UserProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserProfileRepository extends JpaRepository<UserProfile, UUID> {

    @Query("SELECT up.userId AS userId, up.avatarUrl AS avatarUrl FROM UserProfile up WHERE up.userId IN :userIds")
    List<UserAvatarProjection> findAvatarsByUserIds(@Param("userIds") Collection<UUID> userIds);

    @Query("SELECT up.avatarUrl FROM UserProfile up WHERE up.userId = :userId")
    Optional<String> findAvatarUrlByUserId(@Param("userId") UUID userId);
}
