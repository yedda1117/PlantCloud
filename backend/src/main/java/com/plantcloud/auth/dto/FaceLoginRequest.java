package com.plantcloud.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class FaceLoginRequest {

    @NotBlank
    private String faceImage;
}
