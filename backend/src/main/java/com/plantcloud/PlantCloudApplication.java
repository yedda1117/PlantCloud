package com.plantcloud;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class PlantCloudApplication {

    public static void main(String[] args) {
        SpringApplication.run(PlantCloudApplication.class, args);
    }
}
