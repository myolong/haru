// 광고 자리. 애드센스(H5 게임 광고) 승인 전까지는 광고 없이 바로 보상을 줍니다.
// 승인 후 adBreak() 코드로 이 두 함수만 바꾸면 됩니다.
window.Ads = {
  // 판 사이 광고 (다음 날 장사 시작 전)
  interstitial: function (done) { done(); },
  // 보상형 광고 (순이익 2배 받기). 광고를 끝까지 보면 done(true)
  rewarded: function (done) { done(true); }
};
