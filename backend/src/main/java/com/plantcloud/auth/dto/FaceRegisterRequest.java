package com.plantcloud.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class FaceRegisterRequest {

    @NotBlank
    private String username;

    @NotBlank
    private String password;

    @NotBlank
    private String faceImage;
}
