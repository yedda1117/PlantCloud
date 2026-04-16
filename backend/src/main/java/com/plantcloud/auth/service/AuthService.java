package com.plantcloud.auth.service;

import com.plantcloud.auth.dto.FaceRegisterRequest;
import com.plantcloud.auth.dto.FaceLoginRequest;
import com.plantcloud.auth.dto.LoginRequest;
import com.plantcloud.auth.vo.LoginVO;

public interface AuthService {

    LoginVO login(LoginRequest request);

    void registerFace(FaceRegisterRequest request);

    LoginVO faceLogin(FaceLoginRequest request);
}
