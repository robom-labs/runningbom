// 화면 공통 템플릿과 필터 버튼을 제공하는 미리보기 UI 유틸리티입니다.
export function html(strings, ...values) {
  return strings.reduce((result, part, index) => result + part + (values[index] ?? ''), '');
}

export function switchButtons(values, current, kind, labels = {}) {
  return values.map((value) => `<button class="filter ${current === value ? 'active' : ''}" data-filter-kind="${kind}" data-filter="${value}">${labels[value] || value}</button>`).join('');
}
