package com.plantcloud.user.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.plantcloud.common.model.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@TableName("users")
@EqualsAndHashCode(callSuper = true)
public class User extends BaseEntity {

    private String username;
    private String passwordHash;
    private String nickname;
    private String email;
    private String phone;
    private String role;
    private String status;
    private String faceImage;
}
