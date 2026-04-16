package com.plantcloud.security.jwt;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Date;

@Component
public class JwtTokenUtil {

    private final String secret;
    private final long accessExpireSeconds;
    private SecretKey signingKey;

    public JwtTokenUtil(@Value("${app.jwt.secret}") String secret,
                        @Value("${app.jwt.access-token-expire-seconds}") long accessExpireSeconds) {
        this.secret = secret;
        this.accessExpireSeconds = accessExpireSeconds;
    }

    @PostConstruct
    public void init() {
        byte[] keyBytes = normalizeSecret(secret);
        signingKey = Keys.hmacShaKeyFor(keyBytes);
    }

    private byte[] normalizeSecret(String secretText) {
        byte[] bytes = secretText.getBytes(StandardCharsets.UTF_8);
        if (bytes.length >= 32) {
            return bytes;
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return digest.digest(bytes);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("Unable to initialize JWT secret key", e);
        }
    }

    public String generateAccessToken(Long userId, String username, String role) {
        Date now = new Date();
        Date expiration = new Date(now.getTime() + accessExpireSeconds * 1000);

        return Jwts.builder()
                .setSubject(username)
                .setIssuedAt(now)
                .setExpiration(expiration)
                .claim("userId", userId)
                .claim("role", role)
                .signWith(signingKey, SignatureAlgorithm.HS256)
                .compact();
    }

    public Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String getUsernameFromToken(String token) {
        return parseClaims(token).getSubject();
    }

    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (Exception ex) {
            return false;
        }
    }
}
