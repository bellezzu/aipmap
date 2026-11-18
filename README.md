# 어디까지 갈까?

출발지와 도착지를 검색해 자동차 이동 거리를 확인하는 정적 웹앱입니다.

## 실행

저장소를 내려받은 뒤 `index.html`을 브라우저에서 열면 됩니다. 별도의 빌드, 서버, Redis 또는 환경변수 설정이 필요하지 않습니다. 인터넷 연결이 있어야 장소 검색과 경로 조회를 사용할 수 있습니다.

## Vercel 배포

GitHub에 저장소를 만든 뒤 Vercel에서 **Add New → Project**로 저장소를 가져옵니다. 정적 웹사이트로 배포되므로 빌드 명령이나 환경변수 없이 기본 설정으로 배포할 수 있습니다.

## 데이터 제공처

- 장소 검색: [Nominatim](https://nominatim.openstreetmap.org/)
- 자동차 경로 거리: [OSRM demo server](https://router.project-osrm.org/)
- 지도 및 길찾기: [OpenStreetMap](https://www.openstreetmap.org/)

경로 거리는 자동차 기준이며 실제 교통 상황이나 도로 통제에 따른 예상 시간은 제공하지 않습니다. 공개 검색·경로 서비스는 사용량 정책 및 가용성에 따라 제한될 수 있습니다.
