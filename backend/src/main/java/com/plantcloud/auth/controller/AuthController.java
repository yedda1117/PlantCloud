package com.plantcloud.auth.controller;

import com.plantcloud.auth.dto.FaceRegisterRequest;
import com.plantcloud.auth.dto.FaceLoginRequest;
import com.plantcloud.auth.dto.LoginRequest;
import com.plantcloud.auth.service.AuthService;
import com.plantcloud.auth.vo.LoginVO;
import com.plantcloud.common.result.Result;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public Result<LoginVO> login(@Valid @RequestBody LoginRequest request) {
        return Result.ok(authService.login(request));
    }

    @PostMapping("/face-register")
    public Result<Void> faceRegister(@Valid @RequestBody FaceRegisterRequest request) {
        authService.registerFace(request);
        return Result.ok(null);
    }

    @PostMapping("/face-login")
    public Result<LoginVO> faceLogin(@Valid @RequestBody FaceLoginRequest request) {
        return Result.ok(authService.faceLogin(request));
    }
}
