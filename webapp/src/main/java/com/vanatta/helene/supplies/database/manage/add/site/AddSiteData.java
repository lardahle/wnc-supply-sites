package com.vanatta.helene.supplies.database.manage.add.site;

import com.vanatta.helene.supplies.database.data.SiteType;
import jakarta.annotation.Nonnull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Value;

@Builder(toBuilder = true)
@AllArgsConstructor
@Value
public class AddSiteData {

  @Nonnull String siteName;
  @Nonnull String streetAddress;
  @Nonnull String city;
  @Nonnull String state;
  @Nonnull String county;
  String website;
  String facebook;
  @Nonnull SiteType siteType;
  String siteHours;

  @Nonnull String maxSupplyLoad;
  String receivingNotes;

  String contactName;
  String contactNumber;

  Number deploymentId;

  @SuppressWarnings("ConstantValue")
  public boolean isMissingRequiredData() {
    return siteType == null
        || siteName == null
        || streetAddress == null
        || city == null
        || county == null
        || state == null;
  }

  String getSiteName() {
    return siteName == null ? null : siteName.trim();
  }

  String getStreetAddress() {
    return streetAddress == null ? null : streetAddress.trim();
  }

  String getCity() {
    return city == null ? null : city.trim();
  }

  String getWebsite() {
    return website == null ? null : website.trim();
  }

  String getContactNumber() {
    return contactNumber == null ? null : contactNumber.trim();
  }
}
