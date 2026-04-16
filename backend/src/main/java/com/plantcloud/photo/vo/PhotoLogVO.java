package com.plantcloud.photo.vo;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PhotoLogVO {

    private Long id;
    private Long plantId;
    private String date;
    private String originPhotoUrl;
    private String photoUrl;
    private String thumbnailUrl;
    private String milestone;
    private String note;
    private Boolean hasPhoto;
    private String aiStatus;
}
