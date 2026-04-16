package com.plantcloud.photo.service;

import com.plantcloud.photo.vo.PhotoLogVO;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;

public interface PhotoService {

    PhotoLogVO upload(Long plantId,
                      LocalDate date,
                      MultipartFile photo,
                      String note,
                      String milestone);

    void deletePhoto(Long plantId, LocalDate date);
}
