// 러닝봄 번들 대회와 필터가 공유하는 타입을 정의합니다.
export type RaceDistance = '5K' | '10K' | 'Half' | 'Full' | 'Trail' | string;

export type Race = {
  id: string;
  name: string;
  region: string;
  venue: string;
  raceDate: string;
  distances: RaceDistance[];
  registrationOpensAt: string;
  registrationClosesAt?: string;
  registrationTimeConfirmed: boolean;
  registrationWindows?: Array<{
    label?: string;
    distance?: string;
    opensAt: string;
    closesAt?: string;
    timeConfirmed?: boolean;
  }>;
  registrationStatus?: 'open' | 'scheduled' | 'closed' | 'sold_out' | 'cancelled' | 'unknown' | string;
  /** 일정 파싱 오류 또는 마지막 확인 시각 부재로 기본 행동 경로에서 보류된 데이터입니다. */
  registrationDataStatus?: 'needs-review';
  registrationDataIssue?: string;
  registrationPeriodLabel?: string;
  note?: string;
  capacity?: number;
  organizer?: string;
  /** 원본 행을 마지막으로 확인한 시각입니다. 없는 값은 확인 시각을 알 수 없다는 뜻입니다. */
  sourceCheckedAt?: string;
  /** 사용자가 접수 행동을 할 수 있는 HTTPS 주소입니다. 권한을 자동으로 뜻하지는 않습니다. */
  registrationUrl?: string;
  /** 일정 값을 확인한 대회 정보 출처의 HTTPS 주소입니다. */
  sourceDetailUrl?: string;
  /** 외부 링크를 안내한 원본 근거 설명입니다. 확인 시각이나 공식성의 증거로 쓰지 않습니다. */
  linkReference?: string;
  /** 현재 앱이 외부로 연결할 HTTPS 주소입니다. `officialUrl`은 구버전 호환용 별칭입니다. */
  externalUrl?: string;
  verifiedAt?: string;
  officialUrl?: string;
  externalLinkKind?: 'registration' | 'source' | 'official';
  sourceName: string;
};

export type RegionFilter = '전체' | string;
export type DistanceFilter = '전체' | RaceDistance;
