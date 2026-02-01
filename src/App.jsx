import React, { useState, useEffect, useRef } from 'react';
import { Save, FolderOpen, RefreshCw, FileDown, Plus, Trash2, Info, Activity, User, Briefcase, Calculator, FileText, CheckSquare, Stethoscope, X, Eye, Upload, ChevronDown } from 'lucide-react';

/* [🚀 오프라인/일렉트론 배포를 위한 설정 가이드]
  1. 프로젝트 폴더 터미널에서 `npm install xlsx`를 실행하여 라이브러리를 설치하세요.
  2. 아래 `import * as XLSX_LIB ...` 코드의 주석(//)을 해제하세요.
  3. 코드 하단의 `useEffect` (CDN 로딩 부분)을 삭제하거나 주석 처리하세요.
  4. `handleExportXLSX` 등의 함수에서 `window.XLSX` 대신 `XLSX_LIB`를 사용하도록 수정하세요.
*/

// import * as XLSX_LIB from 'xlsx'; // <--- 오프라인 배포 시 주석 해제

// --- 1. CONSTANTS & PRESETS ---
const JOB_PRESETS = [
  { category: '직접입력', jobName: '', weight: 0, squatting: 0 },
  { category: '건설업', jobName: '철근공 (배근작업)', weight: 2500, squatting: 180, desc: '철근 운반 및 쪼그려 앉아 결속 작업' },
  { category: '건설업', jobName: '형틀목공', weight: 1500, squatting: 120, desc: '거푸집 설치 및 해체' },
  { category: '건설업', jobName: '미장공', weight: 500, squatting: 240, desc: '바닥 미장 작업' },
  { category: '제조업', jobName: '용접공 (조선)', weight: 1000, squatting: 300, desc: '협소한 공간 쪼그려 용접' },
  { category: '제조업', jobName: '자동차 조립원', weight: 800, squatting: 120, desc: '라인 작업, 하체 조립' },
  { category: '물류/서비스', jobName: '택배 상하차원', weight: 5000, squatting: 30, desc: '고중량물 반복 들기' },
  { category: '농업', jobName: '고추 수확', weight: 200, squatting: 400, desc: '장시간 쪼그려 앉아 수확' },
  { category: '서비스', jobName: '조리 종사자', weight: 500, squatting: 60, desc: '식자재 운반 및 낮은 자세 세척' },
];

const BODY_PARTS = ["목", "어깨", "팔꿈치", "손목", "손가락", "허리", "무릎", "고관절", "발목"];
const BILATERAL_PARTS = ["어깨", "팔꿈치", "손목", "손가락", "무릎", "고관절", "발목"];

const AUX_FACTORS = [
  { id: 'stairs', label: '계단 오르내리기' },
  { id: 'twisting', label: '무릎 비틀림' },
  { id: 'startStop', label: '출발/정지 반복' },
  { id: 'narrow', label: '좁은 공간' },
  { id: 'impact', label: '무릎 접촉/충격' },
  { id: 'jump', label: '뛰어내리기' },
];

const REASON_LABELS = {
  insufficient_burden: "누적신체부담이 충분하지 않음",
  unrelated: "신체부담과 무관 (외상 등)",
  mild: "연령 대비 퇴행성 변화 경미",
  expired: "업무 중단 후 상당기간 경과",
  other: "기타 사유"
};

// --- 2. LOGIC HELPERS ---

const determineBurdenLevel = (W, T) => {
  if (
    (W >= 3000 && T >= 180) ||
    (W >= 3000 && T >= 120 && T < 180) ||
    (W >= 2000 && W < 3000 && T >= 180)
  ) {
    return { level: '고', minScore: 6.0, maxScore: 9.0, color: 'text-red-600' };
  } else if (
    (W >= 3000 && T >= 60 && T < 120) ||
    (W >= 2000 && W < 3000 && T >= 120 && T < 180) ||
    (W < 2000 && T >= 120)
  ) {
    return { level: '중상', minScore: 3.0, maxScore: 6.0, color: 'text-orange-500' };
  } else if (
    (W >= 3000 && T < 60) ||
    (W >= 2000 && W < 3000 && T < 120) ||
    (W < 2000 && T >= 60 && T < 120)
  ) {
    return { level: '중하', minScore: 2.0, maxScore: 4.0, color: 'text-yellow-600' };
  } else {
    return { level: '하', minScore: 1.0, maxScore: 2.0, color: 'text-green-600' };
  }
};

const calculateAge = (birthDate, injuryDate) => {
  if (!birthDate || !injuryDate) return 0;
  const birth = new Date(birthDate);
  const injury = new Date(injuryDate);
  let age = injury.getFullYear() - birth.getFullYear();
  const m = injury.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && injury.getDate() < birth.getDate())) {
    age--;
  }
  return age < 0 ? 0 : age;
};

const calculateBMI = (heightCm, weightKg) => {
  if (!heightCm || !weightKg) return '';
  const heightM = heightCm / 100;
  return (weightKg / (heightM * heightM)).toFixed(1);
};

const getKlgText = (val) => val === '0' ? '해당없음' : `${val}등급`;

// Helper: Convert decimal years to "X년 Y개월"
const formatDurationText = (decimalYears) => {
    if (!decimalYears || isNaN(decimalYears)) return "0년 0개월";
    const years = Math.floor(decimalYears);
    const months = Math.round((decimalYears - years) * 12);
    if (months === 12) return `${years + 1}년 0개월`;
    return `${years}년 ${months}개월`;
};

// Helper: Format Diagnosis String for UI (Detailed)
const formatDiagnosisName = (d) => {
    let parts = [];
    if(d.code) parts.push(d.code);
    if(d.name) parts.push(d.name);
    parts.push(d.bodyPart);

    // Determine Side Text for UI
    const isBilateral = BILATERAL_PARTS.includes(d.bodyPart);
    if (isBilateral) {
        if (d.side === 'R') parts.push('우측');
        else if (d.side === 'L') parts.push('좌측');
        else if (d.side === 'B') parts.push('양측');
    }
    
    return parts.join(' ');
};

// Helper: Format Diagnosis String for Header (Simple: Code + Name only)
const formatDiagnosisHeaderSimple = (d) => {
    let parts = [];
    if(d.code) parts.push(d.code);
    if(d.name) parts.push(d.name);
    // Body part and side are removed as requested for the header
    return parts.join(' ');
};

// Checkbox format helper for Excel
const toCheck = (label, isChecked) => `[${isChecked ? 'V' : '  '}] ${label}`;

// --- 3. STATE FACTORY ---
const createNewPatient = (id = Date.now(), name = '새 환자') => ({
  id,
  name, 
  basicInfo: {
    name: '', gender: 'M', height: '', weight: '', birthDate: '', injuryDate: '',
    hospital: '', department: '직업환경의학', doctor: ''
  },
  medicalInfo: {
    diagnoses: [
      { 
        id: Date.now() + 1, code: '', name: '', 
        bodyPart: '무릎', side: 'R', 
        klgGrade: { R: '0', L: '0' },
        confirmedStatus: { R: 'confirm', L: 'confirm' }, 
        relevance: { R: 'low', L: 'low' }, 
        relevanceReason: { R: 'insufficient_burden', L: 'insufficient_burden' },
        relevanceReasonText: { R: '', L: '' } 
      }
    ],
    notes: ''
  },
  jobs: [
    { 
      id: Date.now() + 2, jobName: '', startDate: '', endDate: '', 
      durationYears: 0, durationMonths: 0, duration: 0, 
      weight: 0, squatting: 0, burden: determineBurdenLevel(0,0),
      evidence: { health: false, employ: false, income: false, etc: false },
      auxiliary: { stairs: false, twisting: false, startStop: false, narrow: false, impact: false, jump: false }
    }
  ],
  assessment: {
    returnConsideration: ''
  },
  calculatedResult: {
    age: 0, bmi: '', 
    minRelevance: 0, maxRelevance: 0, avgRelevance: 0,
    judgment: '불충분함'
  }
});


export default function App() {
  // --- GLOBAL STATE ---
  const [patients, setPatients] = useState([createNewPatient(Date.now(), '새 환자 1')]);
  const [activeTabId, setActiveTabId] = useState(patients[0].id);
  const [isExcelReady, setIsExcelReady] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  const fileInputRef = useRef(null);
  const resultSectionRef = useRef(null);

  const activePatient = patients.find(p => p.id === activeTabId) || patients[0];

  const updateActivePatient = (field, value) => {
    setPatients(prev => prev.map(p => 
      p.id === activeTabId ? { ...p, [field]: value } : p
    ));
  };

  const updateActivePatientDeep = (section, field, value) => {
    setPatients(prev => prev.map(p => 
      p.id === activeTabId ? { ...p, [section]: { ...p[section], [field]: value } } : p
    ));
  };

  // Scroll Helper
  const scrollToResults = () => {
    resultSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // --- GLOBAL EFFECTS ---
  
  // CDN Load for XLSX (For preview environment)
  useEffect(() => {
    if (!window.XLSX) {
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      script.async = true;
      script.onload = () => setIsExcelReady(true);
      document.body.appendChild(script);
    } else {
      setIsExcelReady(true);
    }
  }, []);

  useEffect(() => {
    setPatients(prevPatients => prevPatients.map(p => {
        const age = calculateAge(p.basicInfo.birthDate, p.basicInfo.injuryDate);
        const bmi = calculateBMI(p.basicInfo.height, p.basicInfo.weight);

        // Recalculate Burden Level only
        let updatedJobs = p.jobs.map(job => {
            const burden = determineBurdenLevel(Number(job.weight), Number(job.squatting));
            const totalDuration = (Number(job.durationYears) || 0) + ((Number(job.durationMonths) || 0) / 12);
            return { ...job, burden, duration: totalDuration };
        });

        const effectiveAgeDiff = Math.max(0, age - 30);
        const ageFactor = 1.0 * effectiveAgeDiff;
        let numeratorMin = 0, numeratorMax = 0;

        updatedJobs.forEach(job => {
            const dur = parseFloat(job.duration) || 0;
            numeratorMin += (job.burden.minScore - 1.0) * dur;
            numeratorMax += (job.burden.maxScore - 1.0) * dur;
        });

        const denomMin = ageFactor + numeratorMin;
        const denomMax = ageFactor + numeratorMax;

        let resultMin = denomMin > 0 ? (numeratorMin / denomMin) * 100 : 0;
        let resultMax = denomMax > 0 ? (numeratorMax / denomMax) * 100 : 0;

        const finalMin = Math.max(0, Math.min(100, resultMin));
        const finalMax = Math.max(0, Math.min(100, resultMax));
        const finalAvg = (finalMin + finalMax) / 2;
        const judgment = finalAvg >= 50 ? '충분함' : '불충분함';
        
        return {
            ...p,
            jobs: updatedJobs,
            name: p.basicInfo.name || p.name,
            calculatedResult: {
                age, bmi,
                minRelevance: finalMin.toFixed(1),
                maxRelevance: finalMax.toFixed(1),
                avgRelevance: finalAvg,
                judgment
            }
        };
    }));
  }, [JSON.stringify(patients.map(p => ({ 
      b: p.basicInfo, 
      j: p.jobs.map(j=>({w:j.weight, s:j.squatting, dy:j.durationYears, dm:j.durationMonths})) 
  })))]); 

  // --- HANDLERS ---
  const addTab = () => {
    const newP = createNewPatient(Date.now(), `새 환자 ${patients.length + 1}`);
    setPatients([...patients, newP]);
    setActiveTabId(newP.id);
  };

  const removeTab = (e, id) => {
    e.stopPropagation();
    if (patients.length === 1) {
        alert("최소 하나의 탭은 유지해야 합니다.");
        return;
    }
    if (window.confirm("정말 이 환자의 데이터를 삭제하시겠습니까?")) {
        const newPatients = patients.filter(p => p.id !== id);
        setPatients(newPatients);
        if (activeTabId === id) {
            setActiveTabId(newPatients[0].id);
        }
    }
  };

  const handleBasicInfoChange = (field, value) => {
    updateActivePatientDeep('basicInfo', field, value);
  };

  const handleJobChange = (jobId, field, value) => {
    const currentJob = activePatient.jobs.find(j => j.id === jobId);
    
    let updates = { [field]: value };

    // Auto-calculate duration if dates change
    if (field === 'startDate' || field === 'endDate') {
        const start = field === 'startDate' ? new Date(value) : new Date(currentJob.startDate);
        const end = field === 'endDate' ? new Date(value) : new Date(currentJob.endDate);
        
        if (start && end && !isNaN(start) && !isNaN(end)) {
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            const decimalYears = diffDays / 365.25;
            
            const years = Math.floor(decimalYears);
            const months = Math.round((decimalYears - years) * 12);
            
            updates.durationYears = years + (months === 12 ? 1 : 0);
            updates.durationMonths = months === 12 ? 0 : months;
        }
    }

    const updatedJobs = activePatient.jobs.map(job => 
        job.id === jobId ? { ...job, ...updates } : job
    );
    updateActivePatient('jobs', updatedJobs);
  };

  const handleEvidenceChange = (jobId, key) => {
    const updatedJobs = activePatient.jobs.map(job => 
        job.id === jobId ? { ...job, evidence: { ...job.evidence, [key]: !job.evidence[key] } } : job
    );
    updateActivePatient('jobs', updatedJobs);
  };

  const handleAuxiliaryChange = (jobId, key) => {
    const updatedJobs = activePatient.jobs.map(job => 
        job.id === jobId ? { ...job, auxiliary: { ...job.auxiliary, [key]: !job.auxiliary[key] } } : job
    );
    updateActivePatient('jobs', updatedJobs);
  };

  const addJob = () => {
    const newJob = { 
        id: Date.now(), jobName: '', startDate: '', endDate: '', durationYears: 0, durationMonths: 0, duration: 0, weight: 0, squatting: 0, burden: determineBurdenLevel(0,0),
        evidence: { health: false, employ: false, income: false, etc: false },
        auxiliary: { stairs: false, twisting: false, startStop: false, narrow: false, impact: false, jump: false }
    };
    updateActivePatient('jobs', [...activePatient.jobs, newJob]);
  };

  const removeJob = (jobId) => {
    if (activePatient.jobs.length > 1) {
        updateActivePatient('jobs', activePatient.jobs.filter(j => j.id !== jobId));
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const XL = window.XLSX; // Or import
    if (!XL) { alert("엑셀 라이브러리 로딩 중..."); return; }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target.result;
      const workbook = XL.read(data, { type: 'binary' });
      const newImportedPatients = [];

      workbook.SheetNames.forEach((sheetName, idx) => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XL.utils.sheet_to_json(worksheet, { header: 1 });
          if(!jsonData || jsonData.length === 0) return;

          let p = createNewPatient(Date.now() + idx, sheetName); 
          let notes = "";

          jsonData.forEach((row, rowIndex) => {
             if (!row || row.length === 0) return;
             row.forEach((cell, cellIndex) => {
                if (typeof cell === 'string') {
                    if (cell.includes("이름/성별")) {
                        const val = row[cellIndex + 1];
                        if (val && typeof val === 'string') {
                            const parts = val.split('(');
                            if (parts[0]) p.basicInfo.name = parts[0].trim();
                            if (parts[1]) p.basicInfo.gender = parts[1].includes('남') ? 'M' : 'F';
                        }
                    }
                    if (cell.includes("키/몸무게")) {
                        const val = row[cellIndex + 1];
                        if (val && typeof val === 'string') {
                            const parts = val.split('/');
                            if (parts[0]) p.basicInfo.height = parts[0].replace(/[^0-9.]/g, '');
                            if (parts[1]) p.basicInfo.weight = parts[1].replace(/[^0-9.]/g, '');
                        }
                    }
                    if (cell.includes("생년월일")) p.basicInfo.birthDate = row[cellIndex + 1] || '';
                    if (cell.includes("재해일자")) p.basicInfo.injuryDate = row[cellIndex + 1] || '';
                    if (cell.includes("특이사항")) notes = row[cellIndex + 1] || '';
                }
             });

             if (row.includes("직종") && row.includes("근무시작")) {
                 p.jobs = []; 
                 let i = rowIndex + 1;
                 while (i < jsonData.length) {
                     const jobRow = jsonData[i];
                     if (!jobRow || !jobRow[0]) break;
                     
                     let durY = 0, durM = 0;
                     const durStr = jobRow[3] ? String(jobRow[3]) : '';
                     if(durStr.includes('년')) {
                         durY = parseInt(durStr.split('년')[0]) || 0;
                         if(durStr.includes('개월')) durM = parseInt(durStr.split('년')[1].replace('개월','')) || 0;
                     } else {
                         durY = parseFloat(durStr) || 0; 
                     }

                     p.jobs.push({
                         id: Date.now() + idx + i, 
                         jobName: jobRow[0],
                         startDate: jobRow[1] || '',
                         endDate: jobRow[2] || '',
                         durationYears: durY,
                         durationMonths: durM,
                         duration: durY + (durM/12),
                         evidence: {
                             health: jobRow[4] === 'V', employ: jobRow[5] === 'V', income: jobRow[6] === 'V', etc: jobRow[7] === 'V'
                         },
                         weight: 0, squatting: 0, burden: determineBurdenLevel(0,0),
                         auxiliary: { stairs: false, twisting: false, startStop: false, narrow: false, impact: false, jump: false }
                     });
                     i++;
                 }
             }
          });

          if (p.basicInfo.name) p.name = p.basicInfo.name;
          if (notes) p.medicalInfo.notes = notes;
          if (p.basicInfo.name || p.jobs.length > 0) newImportedPatients.push(p);
      });

      if (newImportedPatients.length > 0) {
          if (window.confirm(`총 ${newImportedPatients.length}명의 데이터를 불러왔습니다. 추가하시겠습니까?`)) {
              setPatients(prev => [...prev, ...newImportedPatients]);
              setActiveTabId(newImportedPatients[0].id);
          }
      } else {
          alert("유효한 데이터를 찾지 못했습니다.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleExportXLSX = () => {
    const XL = window.XLSX; // Or import
    if (!XL) return;

    const wb = XL.utils.book_new();
    
    patients.forEach(p => {
        const wsData = [];
        const merges = [];
        
        wsData.push(["업무관련성 특별진찰 소견서(근골격계질병)"]);
        merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } });
        wsData.push([]);
        
        wsData.push(["1. 기본정보"]);
        merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: 7 } });
        wsData.push([
            "이름/성별", `${p.basicInfo.name} (${p.basicInfo.gender === 'M' ? '남' : '여'})`,
            "키/몸무게", `${p.basicInfo.height}cm / ${p.basicInfo.weight}kg`,
            "생년월일", p.basicInfo.birthDate,
            "재해일자", p.basicInfo.injuryDate
        ]);

        const diagnosisLines = p.medicalInfo.diagnoses.map(d => {
            const isBilateral = BILATERAL_PARTS.includes(d.bodyPart);
            let klgInfo = "";
            if (!isBilateral) {
                 klgInfo = `KL:${getKlgText(d.klgGrade.R)}`; 
            } else {
                 if (d.side === 'R') klgInfo = `KL(우):${getKlgText(d.klgGrade.R)}`;
                 else if (d.side === 'L') klgInfo = `KL(좌):${getKlgText(d.klgGrade.L)}`;
                 else klgInfo = `KL(우):${getKlgText(d.klgGrade.R)}/KL(좌):${getKlgText(d.klgGrade.L)}`;
            }
            // Use formatDiagnosisName (UI) because Section 1 list is usually detailed
            return formatDiagnosisName(d) + ` [${klgInfo}]`; 
        }).join("\n");

        wsData.push(["상병 및 의학소견", diagnosisLines]);
        merges.push({ s: { r: wsData.length-1, c: 1 }, e: { r: wsData.length-1, c: 7 } });
        wsData.push(["특이사항", p.medicalInfo.notes]);
        merges.push({ s: { r: wsData.length-1, c: 1 }, e: { r: wsData.length-1, c: 7 } });
        wsData.push([]);

        wsData.push(["2. 직업력 조사"]);
        merges.push({ s: { r: wsData.length-1, c: 0 }, e: { r: wsData.length-1, c: 7 } });
        wsData.push(["직종", "근무시작", "근무종료", "근무기간", "건강/연금", "고용/산재", "소득금액", "기타"]);
        p.jobs.forEach(job => {
            wsData.push([
                job.jobName, job.startDate, job.endDate, `${job.durationYears}년 ${job.durationMonths}개월`,
                job.evidence.health ? "V" : "", job.evidence.employ ? "V" : "", job.evidence.income ? "V" : "", job.evidence.etc ? "V" : ""
            ]);
        });
        wsData.push([]);

        wsData.push(["3. 신체부담수준 평가"]);
        merges.push({ s: { r: wsData.length-1, c: 0 }, e: { r: wsData.length-1, c: 7 } });
        const burdenHeader = ["위험인자", ...p.jobs.map((_, i) => `직력 ${i+1}`), "비고"];
        wsData.push(burdenHeader);
        wsData.push(["쪼그려앉기(분/일)", ...p.jobs.map(j => j.squatting), ""]);
        wsData.push(["중량물 취급(kg/일)", ...p.jobs.map(j => j.weight), ""]);
        AUX_FACTORS.forEach(f => {
            wsData.push([f.label, ...p.jobs.map(j => j.auxiliary[f.id] ? "V" : ""), ""]);
        });
        wsData.push(["신체부담등급", ...p.jobs.map(j => determineBurdenLevel(j.weight, j.squatting).level), ""]);
        wsData.push([]);

        // --- 4. 종합 소견 ---
        wsData.push(["4. 종합 소견"]);
        merges.push({ s: { r: wsData.length-1, c: 0 }, e: { r: wsData.length-1, c: 7 } });
        
        const isSufficient = p.calculatedResult.judgment === '충분함';
        const burdenText = `평균 ${p.calculatedResult.avgRelevance.toFixed(1)}%\n` + 
                           `${toCheck('충분함', isSufficient)}  ${toCheck('불충분함', !isSufficient)}`;
        wsData.push(["누적부담평가", burdenText]);
        merges.push({ s: { r: wsData.length-1, c: 1 }, e: { r: wsData.length-1, c: 7 } });
        
        // Final Opinion (Split Cells)
        // Header
        const startRow = wsData.length;
        
        p.medicalInfo.diagnoses.forEach((d, i) => {
            const isBilateral = BILATERAL_PARTS.includes(d.bodyPart);
            
            const sidesToCheck = isBilateral ? (d.side === 'B' ? ['R', 'L'] : [d.side]) : ['R']; 

            // Create Rows for this diagnosis
            sidesToCheck.forEach((side, sideIdx) => {
                 // Header: Include side if bilateral (in text)
                 const header = `▶ ${formatDiagnosisHeaderSimple(d)}`; // Simple Header (Code + Name)

                 let res = `\n`;
                 // Removing side label from sub-item, using only main info
                 const label = isBilateral ? (side === 'R' ? '우측' : '좌측') : d.bodyPart;
                 
                 // If bilateral, clarify side in text if needed, but per request, remove it from header
                 // Wait, request said "remove from header", but show in sub-item?
                 // "상병명 헤더에 우측, 좌측과 같은 방향이 같이 표시되어야 하고, 하위 평가 항목에서는 제거되어야 해."
                 // So Header: "M17.0 Name (Right)"
                 
                 let finalHeader = formatDiagnosisHeaderSimple(d);
                 // REMOVED BODY PART AND SIDE FROM HEADER PER USER REQUEST IN v2.16
                 // "상병명 헤더에 부위, 방향 다 빼는게 좋겠네. 그냥 상병코드와 상병명만 보여주게 수정해"
                 // formatDiagnosisHeaderSimple ONLY returns Code + Name. Perfect.
                 
                 const rowHeader = `▶ ${finalHeader}`;

                 res += `   - 상병 상태: ${toCheck('확인', d.confirmedStatus[side] === 'confirm')}  ${toCheck('미확인', d.confirmedStatus[side] !== 'confirm')}\n`;
                 res += `   - 업무관련성 평가: ${toCheck('높음', d.relevance[side] === 'high')}  ${toCheck('낮음', d.relevance[side] === 'low')}\n`;
                 
                 if(d.relevance[side] === 'low') {
                    res += `     [낮음 사유]\n`;
                    res += `     ${toCheck('누적신체부담 부족', d.relevanceReason[side] === 'insufficient_burden')}  ${toCheck('외상 등 무관', d.relevanceReason[side] === 'unrelated')}\n`;
                    res += `     ${toCheck('퇴행성 변화 경미', d.relevanceReason[side] === 'mild')}  ${toCheck('기간 경과', d.relevanceReason[side] === 'expired')}\n`;
                    
                    let otherText = d.relevanceReason[side] === 'other' ? (d.relevanceReasonText[side] ? `: ${d.relevanceReasonText[side]}` : '') : '';
                    res += `     ${toCheck('기타 사유', d.relevanceReason[side] === 'other')}${otherText}\n`;
                 }

                 if (i === 0 && sideIdx === 0) {
                      wsData.push(["업무 관련성 최종 평가", rowHeader + res]);
                 } else {
                      wsData.push(["", rowHeader + res]); // Empty title for merge
                 }
                 // Merge B-H for this row
                 merges.push({ s: { r: wsData.length-1, c: 1 }, e: { r: wsData.length-1, c: 7 } });
            });
        });
        
        // Merge Title Column A across all diagnosis rows
        if (p.medicalInfo.diagnoses.length > 0) {
            merges.push({ s: { r: startRow, c: 0 }, e: { r: wsData.length - 1, c: 0 } });
        } else {
            // Safe fallback
            wsData.push(["업무 관련성 최종 평가", ""]);
            merges.push({ s: { r: wsData.length-1, c: 1 }, e: { r: wsData.length-1, c: 7 } });
        }

        wsData.push(["복귀 고려사항", p.assessment.returnConsideration]);
        merges.push({ s: { r: wsData.length-1, c: 1 }, e: { r: wsData.length-1, c: 7 } });

        const ws = XL.utils.aoa_to_sheet(wsData);
        ws['!merges'] = merges;
        ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 20 }];
        
        const safeName = (p.basicInfo.name || p.name || 'Sheet').replace(/[*/?:[\]]/g, '');
        XL.utils.book_append_sheet(wb, ws, safeName.substring(0, 30));
    });

    XL.writeFile(wb, `업무관련성평가_통합_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleReset = () => { if(confirm("초기화 하시겠습니까?")) window.location.reload(); };
  const handleSave = () => { 
      localStorage.setItem('msd_eval_multi', JSON.stringify({ patients, activeTabId }));
      alert("전체 환자 탭 정보가 저장되었습니다.");
  };
  const handleLoad = () => {
      const saved = localStorage.getItem('msd_eval_multi');
      if(saved) {
          if(confirm("저장된 데이터를 불러오시겠습니까?")) {
              const data = JSON.parse(saved);
              setPatients(data.patients);
              setActiveTabId(data.activeTabId);
          }
      } else alert("저장된 데이터가 없습니다.");
  };


  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col pb-20 lg:pb-0">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4">
            <div className="h-14 flex items-center justify-between">
                <div className="flex items-center gap-2 shrink-0">
                    <Activity className="text-blue-600" size={24} />
                    <h1 className="text-lg font-bold text-slate-800 hidden md:block">근골격계 질환 업무관련성 평가 <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded">v2.16 (Names Fixed)</span></h1>
                    <h1 className="text-lg font-bold text-slate-800 md:hidden">업무관련성 평가 v2.16</h1>
                </div>
                
                <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv, .xlsx, .xls" className="hidden" />
                    <button onClick={() => fileInputRef.current.click()} className="flex items-center gap-1 px-3 py-1.5 text-xs text-blue-800 hover:bg-blue-100 rounded border border-blue-200 bg-blue-50 font-bold whitespace-nowrap"><Upload size={14}/> <span className="hidden md:inline">엑셀 일괄입력</span></button>
                    <button onClick={() => setShowPreview(true)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded border border-slate-200 whitespace-nowrap"><Eye size={14}/> <span className="hidden md:inline">미리보기</span></button>
                    <button onClick={handleLoad} className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded whitespace-nowrap"><FolderOpen size={14}/> <span className="hidden md:inline">불러오기</span></button>
                    <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded font-medium whitespace-nowrap"><Save size={14}/> <span className="hidden md:inline">저장</span></button>
                    <button onClick={handleExportXLSX} className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded font-medium border whitespace-nowrap ${isExcelReady ? 'text-green-700 hover:bg-green-50 border-green-200' : 'text-gray-400 border-gray-200 cursor-not-allowed'}`}>
                        <FileDown size={14}/> <span className="hidden md:inline">{isExcelReady ? 'Excel 저장' : '로딩중'}</span>
                    </button>
                    <button onClick={handleReset} className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded whitespace-nowrap"><RefreshCw size={14}/> <span className="hidden md:inline">초기화</span></button>
                </div>
            </div>
            
            <div className="flex items-center gap-1 overflow-x-auto pb-0 -mb-px no-scrollbar">
                {patients.map(p => (
                    <div key={p.id} onClick={() => setActiveTabId(p.id)} className={`group flex items-center gap-2 px-4 py-2 border-t border-l border-r rounded-t-lg cursor-pointer select-none text-sm min-w-[120px] max-w-[200px] shrink-0 ${activeTabId === p.id ? 'bg-slate-50 border-slate-200 border-b-transparent font-bold text-blue-700 relative z-10' : 'bg-gray-100 border-transparent text-slate-500 hover:bg-gray-50'}`}>
                        <User size={14} className={activeTabId === p.id ? "text-blue-500" : "text-slate-400"}/>
                        <span className="truncate flex-1">{p.basicInfo.name || p.name}</span>
                        <button onClick={(e) => removeTab(e, p.id)} className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-0.5 rounded"><X size={12}/></button>
                    </div>
                ))}
                <button onClick={addTab} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors shrink-0" title="새 환자 추가"><Plus size={18}/></button>
            </div>
        </div>
      </header>

      {showPreview && activePatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl h-[90vh] rounded-lg shadow-2xl flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-lg">
              <h3 className="font-bold text-lg flex items-center gap-2"><FileText size={20}/> 출력물 미리보기 ({activePatient.basicInfo.name || activePatient.name})</h3>
              <button onClick={() => setShowPreview(false)} className="text-slate-500 hover:text-slate-800"><X size={24}/></button>
            </div>
            <div className="p-6 overflow-auto flex-1 font-mono text-xs">
              <div className="bg-white border p-8 shadow-sm min-w-[800px] mx-auto">
                 <h1 className="text-xl font-bold text-center mb-6 border-b-2 border-black pb-2">업무관련성 특별진찰 소견서</h1>
                 {/* Preview Table Implementation */}
                 <table className="w-full border-collapse border border-slate-400 mb-6">
                   <tbody>
                     <tr>
                        <th className="border border-slate-400 bg-slate-100 p-2 w-32">이름/성별</th>
                        <td className="border border-slate-400 p-2">{activePatient.basicInfo.name} ({activePatient.basicInfo.gender === 'M' ? '남' : '여'})</td>
                        <th className="border border-slate-400 bg-slate-100 p-2 w-32">키/몸무게</th>
                        <td className="border border-slate-400 p-2">{activePatient.basicInfo.height}cm / {activePatient.basicInfo.weight}kg</td>
                        <th className="border border-slate-400 bg-slate-100 p-2 w-32">생년월일</th>
                        <td className="border border-slate-400 p-2">{activePatient.basicInfo.birthDate}</td>
                        <th className="border border-slate-400 bg-slate-100 p-2 w-32">재해일자</th>
                        <td className="border border-slate-400 p-2">{activePatient.basicInfo.injuryDate}</td>
                     </tr>
                     <tr>
                        <th className="border border-slate-400 bg-slate-100 p-2">상병 및 의학소견</th>
                        <td className="border border-slate-400 p-2" colSpan="7">
                          {activePatient.medicalInfo.diagnoses.map((d, i) => {
                             const isBilateral = BILATERAL_PARTS.includes(d.bodyPart);
                             let klgInfo = "";
                             if (!isBilateral) {
                                  klgInfo = `KL:${getKlgText(d.klgGrade.R)}`; 
                             } else {
                                  if (d.side === 'R') klgInfo = `KL(우):${getKlgText(d.klgGrade.R)}`;
                                  else if (d.side === 'L') klgInfo = `KL(좌):${getKlgText(d.klgGrade.L)}`;
                                  else klgInfo = `KL(우):${getKlgText(d.klgGrade.R)}/KL(좌):${getKlgText(d.klgGrade.L)}`;
                             }
                             return <div key={i} className="mb-1 border-b border-slate-200 pb-1 last:border-0">[신청] {formatDiagnosisName(d)} <span className="text-blue-600 font-bold">[{klgInfo}]</span></div>
                          })}
                        </td>
                     </tr>
                     <tr>
                        <th className="border border-slate-400 bg-slate-100 p-2">특이사항</th>
                        <td className="border border-slate-400 p-2" colSpan="7">{activePatient.medicalInfo.notes}</td>
                     </tr>
                   </tbody>
                 </table>

                 {/* 2. Job History */}
                 <h2 className="font-bold text-sm mb-2 border-l-4 border-blue-600 pl-2">2. 직업력 조사</h2>
                 <table className="w-full border-collapse border border-slate-400 mb-6 text-center">
                    <thead>
                       <tr className="bg-slate-100">
                          <th className="border border-slate-400 p-2">직종</th>
                          <th className="border border-slate-400 p-2">근무시작</th>
                          <th className="border border-slate-400 p-2">근무종료</th>
                          <th className="border border-slate-400 p-2">근무기간</th>
                          <th className="border border-slate-400 p-2 text-[10px]">건강/연금</th>
                          <th className="border border-slate-400 p-2 text-[10px]">고용/산재</th>
                          <th className="border border-slate-400 p-2 text-[10px]">소득금액</th>
                          <th className="border border-slate-400 p-2 text-[10px]">기타</th>
                       </tr>
                    </thead>
                    <tbody>
                       {activePatient.jobs.map((job, idx) => (
                          <tr key={idx}>
                             <td className="border border-slate-400 p-2">{job.jobName}</td>
                             <td className="border border-slate-400 p-2">{job.startDate}</td>
                             <td className="border border-slate-400 p-2">{job.endDate}</td>
                             <td className="border border-slate-400 p-2">{job.durationYears}년 {job.durationMonths}개월</td>
                             <td className="border border-slate-400 p-2">{job.evidence.health ? 'V' : ''}</td>
                             <td className="border border-slate-400 p-2">{job.evidence.employ ? 'V' : ''}</td>
                             <td className="border border-slate-400 p-2">{job.evidence.income ? 'V' : ''}</td>
                             <td className="border border-slate-400 p-2">{job.evidence.etc ? 'V' : ''}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>

                 {/* 3. Physical Burden */}
                 <h2 className="font-bold text-sm mb-2 border-l-4 border-blue-600 pl-2">3. 신체부담수준 평가</h2>
                 <table className="w-full border-collapse border border-slate-400 mb-6 text-center">
                    <thead>
                       <tr className="bg-slate-100">
                          <th className="border border-slate-400 p-2 w-40">위험인자</th>
                          {activePatient.jobs.map((_, i) => <th key={i} className="border border-slate-400 p-2">직력 {i+1}</th>)}
                          <th className="border border-slate-400 p-2 w-20">비고</th>
                       </tr>
                    </thead>
                    <tbody>
                       <tr>
                          <td className="border border-slate-400 p-2 bg-slate-50 font-bold">쪼그려앉기(분/일)</td>
                          {activePatient.jobs.map((job, i) => <td key={i} className="border border-slate-400 p-2">{job.squatting}</td>)}
                          <td className="border border-slate-400 p-2"></td>
                       </tr>
                       <tr>
                          <td className="border border-slate-400 p-2 bg-slate-50 font-bold">중량물 취급(kg/일)</td>
                          {activePatient.jobs.map((job, i) => <td key={i} className="border border-slate-400 p-2">{job.weight}</td>)}
                          <td className="border border-slate-400 p-2"></td>
                       </tr>
                       {AUX_FACTORS.map(factor => (
                          <tr key={factor.id}>
                             <td className="border border-slate-400 p-2 text-left pl-4 text-slate-600">{factor.label}</td>
                             {activePatient.jobs.map((job, i) => <td key={i} className="border border-slate-400 p-2">{job.auxiliary[factor.id] ? 'V' : ''}</td>)}
                             <td className="border border-slate-400 p-2"></td>
                          </tr>
                       ))}
                       <tr className="bg-slate-100 font-bold">
                          <td className="border border-slate-400 p-2">신체부담등급</td>
                          {activePatient.jobs.map((job, i) => {
                             const b = determineBurdenLevel(job.weight, job.squatting);
                             return <td key={i} className={`border border-slate-400 p-2 ${b.color === 'text-red-600' ? 'text-red-600' : ''}`}>{b.level}</td>
                          })}
                          <td className="border border-slate-400 p-2"></td>
                       </tr>
                    </tbody>
                 </table>

                 {/* 4. Comprehensive Opinion */}
                 <h2 className="font-bold text-sm mb-2 border-l-4 border-blue-600 pl-2">4. 종합 소견</h2>
                 <table className="w-full border-collapse border border-slate-400 mb-6">
                    <tbody>
                       <tr>
                          <th className="border border-slate-400 bg-slate-100 p-2 w-40">누적부담평가</th>
                          <td className="border border-slate-400 p-2">
                             {activePatient.calculatedResult.minRelevance}% ~ {activePatient.calculatedResult.maxRelevance}% (평균 {activePatient.calculatedResult.avgRelevance.toFixed(1)}%) 
                             <br/>
                             <span className="font-bold">판정: {activePatient.calculatedResult.judgment}</span>
                          </td>
                       </tr>
                       
                       {/* Final Assessment Split Row Rendering for Preview */}
                       {activePatient.medicalInfo.diagnoses.map((d, i) => {
                           const isBilateral = BILATERAL_PARTS.includes(d.bodyPart);
                           const sidesToCheck = isBilateral ? (d.side === 'B' ? ['R', 'L'] : [d.side]) : ['R'];
                           
                           return (
                               <React.Fragment key={i}>
                                   {sidesToCheck.map((side, sIdx) => {
                                        let finalHeader = formatDiagnosisHeaderSimple(d);
                                        // Removed Body Part and Side from header per user request v2.16
                                        // Header is now: Code + Name only.

                                        const header = `▶ ${finalHeader}`;
                                        const isLow = d.relevance[side] === 'low';
                                        
                                        return (
                                            <tr key={`${i}-${side}`}>
                                                {i === 0 && sIdx === 0 && (
                                                    <th rowSpan={activePatient.medicalInfo.diagnoses.reduce((acc, curr) => acc + (BILATERAL_PARTS.includes(curr.bodyPart) && curr.side === 'B' ? 2 : 1), 0)} className="border border-slate-400 bg-slate-100 p-2 align-middle">업무관련성 최종 평가</th>
                                                )}
                                                <td className="border border-slate-400 p-2">
                                                    <div className="font-bold mb-1">{header}</div>
                                                    <div className="ml-4 mb-2 text-xs">
                                                        <div className="flex flex-col gap-1 mb-1">
                                                            <div>- 상병 상태: {toCheck('확인', d.confirmedStatus[side] === 'confirm')} {toCheck('미확인', d.confirmedStatus[side] !== 'confirm')}</div>
                                                            <div>- 업무관련성 평가: {toCheck('높음', d.relevance[side] === 'high')} {toCheck('낮음', d.relevance[side] === 'low')}</div>
                                                        </div>
                                                        {isLow && (
                                                            <div className="ml-4 bg-slate-50 p-1 rounded">
                                                                <div className="font-bold text-[10px] mb-1">[낮음 사유]</div>
                                                                <div className="grid grid-cols-1 gap-0.5">
                                                                    <div>{toCheck('누적신체부담 부족', d.relevanceReason[side] === 'insufficient_burden')}</div>
                                                                    <div>{toCheck('외상 등 무관', d.relevanceReason[side] === 'unrelated')}</div>
                                                                    <div>{toCheck('퇴행성 변화 경미', d.relevanceReason[side] === 'mild')}</div>
                                                                    <div>{toCheck('기간 경과', d.relevanceReason[side] === 'expired')}</div>
                                                                    <div>{toCheck('기타 사유', d.relevanceReason[side] === 'other')} {d.relevanceReason[side] === 'other' && d.relevanceReasonText[side] ? `(${d.relevanceReasonText[side]})` : ''}</div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                   })}
                               </React.Fragment>
                           );
                       })}

                       <tr>
                          <th className="border border-slate-400 bg-slate-100 p-2">복귀 고려사항</th>
                          <td className="border border-slate-400 p-2">{activePatient.assessment.returnConsideration}</td>
                       </tr>
                    </tbody>
                 </table>
                 
                 <div className="text-center text-slate-500 mt-8 text-[10px]">
                    * 본 미리보기는 데이터 확인용이며 실제 엑셀 파일은 병합이 적용된 XLSX 파일로 저장됩니다.
                 </div>
              </div>
            </div>
            <div className="p-4 border-t bg-slate-50 rounded-b-lg flex justify-end gap-2">
              <button onClick={() => setShowPreview(false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded text-slate-700 font-bold">닫기</button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 bg-slate-50 overflow-auto">
        <div className="max-w-[1600px] mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 space-y-6">
                
                <section className="bg-white p-4 md:p-5 rounded-lg shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-4 text-blue-800 border-b pb-2">
                        <User size={20}/>
                        <h2 className="font-bold text-lg">1. 기본정보</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">성명</label>
                            <input type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                                value={activePatient.basicInfo.name} onChange={(e)=>handleBasicInfoChange('name', e.target.value)} placeholder="홍길동"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">성별</label>
                            <select className="w-full p-2 border rounded" value={activePatient.basicInfo.gender} onChange={(e)=>handleBasicInfoChange('gender', e.target.value)}>
                                <option value="M">남성</option>
                                <option value="F">여성</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">생년월일</label>
                            <input type="date" className="w-full p-2 border rounded" 
                                value={activePatient.basicInfo.birthDate} onChange={(e)=>handleBasicInfoChange('birthDate', e.target.value)}/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">재해일자 (진단일)</label>
                            <input type="date" className="w-full p-2 border rounded" 
                                value={activePatient.basicInfo.injuryDate} onChange={(e)=>handleBasicInfoChange('injuryDate', e.target.value)}/>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-slate-600 mb-1">신장 (cm)</label>
                                <input type="number" className="w-full p-2 border rounded" placeholder="175"
                                    value={activePatient.basicInfo.height} onChange={(e)=>handleBasicInfoChange('height', e.target.value)}/>
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-slate-600 mb-1">체중 (kg)</label>
                                <input type="number" className="w-full p-2 border rounded" placeholder="70"
                                    value={activePatient.basicInfo.weight} onChange={(e)=>handleBasicInfoChange('weight', e.target.value)}/>
                            </div>
                        </div>
                    </div>
                    {/* Auto-calc display area */}
                    <div className="mt-4 p-3 bg-slate-100 rounded text-center text-sm text-slate-600 flex justify-around">
                        <div>만 나이: <span className="font-bold text-slate-800">{activePatient.calculatedResult.age}세</span></div>
                        <div>BMI: <span className="font-bold text-slate-800">{activePatient.calculatedResult.bmi}</span></div>
                    </div>
                </section>

                <section className="bg-white p-4 md:p-5 rounded-lg shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4 border-b pb-2">
                        <div className="flex items-center gap-2 text-blue-800">
                            <FileText size={20}/>
                            <h2 className="font-bold text-lg">2. 신청 상병</h2>
                        </div>
                        <button onClick={() => {
                            const newDiag = { 
                                id: Date.now(), code: '', name: '', 
                                bodyPart: '무릎', side: 'R', 
                                klgGrade: { R: '0', L: '0' }, confirmedStatus: { R: 'confirm', L: 'confirm' }, relevance: { R: 'low', L: 'low' }, 
                                relevanceReason: { R: 'insufficient_burden', L: 'insufficient_burden' }, relevanceReasonText: { R: '', L: '' }
                            };
                            updateActivePatientDeep('medicalInfo', 'diagnoses', [...activePatient.medicalInfo.diagnoses, newDiag]);
                        }} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 flex items-center gap-1">
                            <Plus size={12}/> 상병 추가
                        </button>
                    </div>
                    <div className="space-y-4">
                        {activePatient.medicalInfo.diagnoses.map((diag, idx) => {
                            const isBilateral = BILATERAL_PARTS.includes(diag.bodyPart);
                            return (
                            <div key={diag.id} className="p-3 bg-blue-50 rounded border border-blue-100 relative">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-sm font-bold text-blue-900">신청 상병 #{idx + 1}</h3>
                                    {activePatient.medicalInfo.diagnoses.length > 1 && (
                                        <button onClick={() => {
                                            updateActivePatientDeep('medicalInfo', 'diagnoses', activePatient.medicalInfo.diagnoses.filter(d => d.id !== diag.id));
                                        }} className="text-slate-400 hover:text-red-500"><X size={14}/></button>
                                    )}
                                </div>
                                <div className="flex gap-2 mb-2">
                                    <input type="text" placeholder="코드 (M17.0)" className="w-1/3 p-2 border rounded text-sm"
                                        value={diag.code} onChange={(e) => {
                                            const newDiags = activePatient.medicalInfo.diagnoses.map(d => d.id === diag.id ? { ...d, code: e.target.value } : d);
                                            updateActivePatientDeep('medicalInfo', 'diagnoses', newDiags);
                                        }}/>
                                    <input type="text" placeholder="신청 진단명 입력" className="w-2/3 p-2 border rounded text-sm"
                                        value={diag.name} onChange={(e) => {
                                            const newDiags = activePatient.medicalInfo.diagnoses.map(d => d.id === diag.id ? { ...d, name: e.target.value } : d);
                                            updateActivePatientDeep('medicalInfo', 'diagnoses', newDiags);
                                        }}/>
                                </div>
                                <div className="flex flex-col gap-2 bg-white p-2 rounded border border-blue-100">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-500 w-16">부위 선택:</span>
                                        <select className="p-1 border rounded text-sm flex-1" 
                                            value={diag.bodyPart} 
                                            onChange={(e) => {
                                                const newBodyPart = e.target.value;
                                                const isNewBilateral = BILATERAL_PARTS.includes(newBodyPart);
                                                // If switching to non-bilateral, force side to 'R' (generic slot)
                                                const newSide = isNewBilateral ? diag.side : 'R';
                                                
                                                const newDiags = activePatient.medicalInfo.diagnoses.map(d => 
                                                    d.id === diag.id ? { ...d, bodyPart: newBodyPart, side: newSide } : d
                                                );
                                                updateActivePatientDeep('medicalInfo', 'diagnoses', newDiags);
                                            }}>
                                            {BODY_PARTS.map(part => <option key={part} value={part}>{part}</option>)}
                                        </select>
                                    </div>
                                    
                                    {isBilateral && (
                                        <div className="flex items-center gap-4 text-sm">
                                            <span className="text-xs font-bold text-slate-500 w-16">방향:</span>
                                            {['R','L','B'].map(side => (
                                                <label key={side} className="flex items-center gap-1 cursor-pointer">
                                                    <input type="radio" checked={diag.side === side} 
                                                        onChange={() => {
                                                            const newDiags = activePatient.medicalInfo.diagnoses.map(d => d.id === diag.id ? { ...d, side: side } : d);
                                                            updateActivePatientDeep('medicalInfo', 'diagnoses', newDiags);
                                                        }}/> {side==='R'?'우측':side==='L'?'좌측':'양측'}
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )})}
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">기타 특이사항</label>
                            <textarea className="w-full p-2 border rounded text-sm h-20 resize-none" placeholder="과거력 등 입력"
                                value={activePatient.medicalInfo.notes} onChange={(e)=>updateActivePatientDeep('medicalInfo', 'notes', e.target.value)}></textarea>
                        </div>
                    </div>
                </section>

                <section className="bg-white p-4 md:p-5 rounded-lg shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4 border-b pb-2">
                        <div className="flex items-center gap-2 text-blue-800">
                            <Briefcase size={20}/>
                            <h2 className="font-bold text-lg">3. 직업력 및 신체부담</h2>
                        </div>
                        <button onClick={addJob} className="text-sm bg-blue-600 text-white px-3 py-1 rounded flex items-center gap-1 hover:bg-blue-700"><Plus size={14}/> 직종 추가</button>
                    </div>
                    <div className="space-y-6">
                        {activePatient.jobs.map((job, index) => {
                            const burden = determineBurdenLevel(job.weight, job.squatting); // Display logic only
                            return (
                                <div key={job.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50 relative">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="text-xs font-bold px-2 py-1 rounded bg-white border shadow-sm text-slate-600">Job #{index + 1}</div>
                                        {activePatient.jobs.length > 1 && (
                                            <button onClick={()=>removeJob(job.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>
                                        )}
                                    </div>
                                    
                                    <div className="mb-3">
                                        <label className="block text-xs font-bold text-slate-500 mb-1">직종 Preset 선택</label>
                                        <select className="w-full p-2 border rounded text-sm bg-white" 
                                            onChange={(e) => {
                                                const preset = JOB_PRESETS.find(p => p.jobName === e.target.value);
                                                if(preset) {
                                                    const updated = activePatient.jobs.map(j => j.id === job.id ? { ...j, jobName: preset.jobName, weight: preset.weight, squatting: preset.squatting } : j);
                                                    updateActivePatient('jobs', updated);
                                                }
                                            }}>
                                            <option value="">선택하세요</option>
                                            {JOB_PRESETS.filter(p=>p.jobName).map(p=><option key={p.jobName} value={p.jobName}>[{p.category}] {p.jobName}</option>)}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">직종명</label>
                                            <input type="text" className="w-full p-2 border rounded text-sm font-semibold" 
                                                value={job.jobName} onChange={(e)=>handleJobChange(job.id, 'jobName', e.target.value)}/>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <label className="block text-xs text-slate-500 mb-1">시작</label>
                                                <input type="date" className="w-full p-2 border rounded text-xs" 
                                                    value={job.startDate} onChange={(e)=>handleJobChange(job.id, 'startDate', e.target.value)}/>
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-xs text-slate-500 mb-1">종료</label>
                                                <input type="date" className="w-full p-2 border rounded text-xs" 
                                                    value={job.endDate} onChange={(e)=>handleJobChange(job.id, 'endDate', e.target.value)}/>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Duration Input Moved Here */}
                                    <div className="mb-3 p-3 bg-blue-50 rounded border border-blue-100">
                                        <label className="block text-xs font-bold text-blue-800 mb-1">근무 기간 (수정 가능)</label>
                                        <div className="flex items-center gap-2 text-sm">
                                            <input type="number" className="w-16 p-1 border rounded text-right" 
                                                value={job.durationYears} onChange={(e)=>handleJobChange(job.id, 'durationYears', Number(e.target.value))}/>
                                            <span>년</span>
                                            <input type="number" className="w-16 p-1 border rounded text-right" 
                                                value={job.durationMonths} onChange={(e)=>handleJobChange(job.id, 'durationMonths', Number(e.target.value))}/>
                                            <span>개월</span>
                                            <span className="text-xs text-slate-500 ml-auto">
                                                (계산용: {job.duration.toFixed(2)}년)
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-3 rounded border border-slate-200">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">중량물 (kg/일)</label>
                                            <input type="number" className="w-full p-2 border rounded text-right" placeholder="0"
                                                value={job.weight} onChange={(e)=>handleJobChange(job.id, 'weight', e.target.value)}/>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">쪼그려앉기 (분/일)</label>
                                            <input type="number" className="w-full p-2 border rounded text-right" placeholder="0"
                                                value={job.squatting} onChange={(e)=>handleJobChange(job.id, 'squatting', e.target.value)}/>
                                        </div>
                                    </div>

                                    <div className="mt-3">
                                        <div className="flex items-center gap-1 mb-2">
                                            <CheckSquare size={14} className="text-slate-400"/>
                                            <label className="text-xs font-bold text-slate-600">보조 노출요인 (해당 시 체크)</label>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            {AUX_FACTORS.map(factor => (
                                            <label key={factor.id} className="flex items-center gap-1 cursor-pointer hover:bg-slate-100 p-1 rounded">
                                                <input type="checkbox" checked={job.auxiliary[factor.id]} onChange={()=>handleAuxiliaryChange(job.id, factor.id)}/> 
                                                {factor.label}
                                            </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-2 border-t text-sm">
                                        <div className="mb-2 bg-slate-50 p-2 rounded border border-slate-100">
                                            <label className="block text-xs font-bold text-slate-500 mb-2">근무 이력 근거자료 (체크)</label>
                                            <div className="flex gap-3 text-xs">
                                                <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={job.evidence.health} onChange={()=>handleEvidenceChange(job.id, 'health')}/> 건강/연금</label>
                                                <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={job.evidence.employ} onChange={()=>handleEvidenceChange(job.id, 'employ')}/> 고용/산재</label>
                                                <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={job.evidence.income} onChange={()=>handleEvidenceChange(job.id, 'income')}/> 소득금액</label>
                                                <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={job.evidence.etc} onChange={()=>handleEvidenceChange(job.id, 'etc')}/> 기타</label>
                                            </div>
                                        </div>
                                        <div className={`font-bold ${burden.color}`}>신체부담: {burden.level} ({burden.minScore}~{burden.maxScore}점)</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>

            <div className="lg:col-span-6 space-y-6" ref={resultSectionRef}>
                <div className="bg-white p-6 rounded-lg shadow-lg border border-blue-200 sticky top-24">
                    <div className="flex items-center gap-2 mb-6 text-blue-900 border-b pb-2">
                        <Calculator size={20}/>
                        <h2 className="font-bold text-lg">종합 소견</h2>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 mb-8 relative">
                        <h4 className="font-extrabold text-lg text-slate-900 mb-4 flex items-center gap-2 bg-slate-100 p-2 rounded">
                            <Activity size={20} className="text-blue-600"/> 1. 누적 신체부담 수준 평가
                            <span className="text-[10px] bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded ml-auto font-normal">자동산출</span>
                        </h4>
                        <div className="text-center mb-4">
                            <div className="text-3xl font-extrabold text-blue-600 tracking-tight">
                                {activePatient.calculatedResult.minRelevance}% ~ {activePatient.calculatedResult.maxRelevance}%
                            </div>
                            <div className="text-xs text-slate-400 mt-1">평균: {activePatient.calculatedResult.avgRelevance.toFixed(1)}%</div>
                            <div className="w-full bg-gray-200 rounded-full h-3 mt-3 overflow-hidden">
                                <div className="bg-blue-500 h-3 rounded-full transition-all duration-500 shadow-inner" style={{ width: `${Math.min(100, activePatient.calculatedResult.avgRelevance)}%` }}></div>
                            </div>
                        </div>
                        <div className={`py-3 px-4 rounded-md text-center border shadow-sm ${activePatient.calculatedResult.judgment === '충분함' ? 'bg-green-100 border-green-300 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
                            <span className="text-xl font-black tracking-wide">{activePatient.calculatedResult.judgment}</span>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h4 className="font-extrabold text-lg text-slate-900 flex items-center gap-2 bg-slate-100 p-2 rounded mb-4">
                            <Stethoscope size={20} className="text-blue-600"/> 2. 업무관련성 평가 결과
                            <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded ml-auto font-normal">전문의 판단</span>
                        </h4>
                        
                        {activePatient.medicalInfo.diagnoses.map((diag, idx) => {
                            const isBilateral = BILATERAL_PARTS.includes(diag.bodyPart);
                            const sidesToRender = isBilateral 
                                ? (diag.side === 'B' ? ['R', 'L'] : [diag.side]) 
                                : ['R']; // Use R slot for single body parts like Neck/Waist

                            return (
                            <div key={diag.id} className="border-2 border-slate-200 rounded-xl p-5 bg-white shadow-sm hover:border-blue-300 transition-colors">
                                <div className="mb-4">
                                    <div className="text-lg font-extrabold text-indigo-900 mb-3 flex items-center gap-2">
                                        <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-full">#{idx + 1}</span>
                                        {formatDiagnosisName(diag)}
                                    </div>
                                    <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100 flex gap-4">
                                        {/* Dynamic KLG */}
                                        {sidesToRender.map(side => (
                                            <div key={side} className="flex-1">
                                                <label className="block text-xs font-bold text-indigo-800 mb-1">
                                                    {isBilateral ? (side==='R'?'우측':'좌측') : diag.bodyPart} KL grade
                                                </label>
                                                <select className="w-full p-2 border rounded text-sm font-bold bg-white text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-400"
                                                    value={diag.klgGrade[side]} 
                                                    onChange={(e)=> {
                                                        const newDiags = activePatient.medicalInfo.diagnoses.map(d => d.id === diag.id ? { ...d, klgGrade: { ...d.klgGrade, [side]: e.target.value } } : d);
                                                        updateActivePatientDeep('medicalInfo', 'diagnoses', newDiags);
                                                    }}>
                                                    <option value="0">해당없음 (Grade 0)</option>
                                                    <option value="1">Grade 1</option>
                                                    <option value="2">Grade 2</option>
                                                    <option value="3">Grade 3</option>
                                                    <option value="4">Grade 4</option>
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    {sidesToRender.map(side => (
                                        <div key={side} className={`p-4 rounded border ${side==='R' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
                                            <div className="flex items-center justify-between mb-3">
                                                <span className={`text-sm font-extrabold ${side==='R'?'text-blue-900':'text-green-900'}`}>
                                                    {isBilateral ? (side==='R'?'우측 (Right)':'좌측 (Left)') : diag.bodyPart}
                                                </span>
                                            </div>
                                            
                                            <div className={`bg-white p-4 rounded border shadow-sm mb-3 ${side==='R'?'border-blue-100':'border-green-100'}`}>
                                                <div className="text-xl font-black text-slate-800 mb-3 tracking-tight">상병 상태</div>
                                                <div className="flex gap-4">
                                                    <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-2 py-1.5 rounded transition-colors">
                                                        <input type="radio" 
                                                            checked={diag.confirmedStatus[side] === 'confirm'} 
                                                            onChange={() => {
                                                                const newDiags = activePatient.medicalInfo.diagnoses.map(d => d.id === diag.id ? { ...d, confirmedStatus: { ...d.confirmedStatus, [side]: 'confirm' } } : d);
                                                                updateActivePatientDeep('medicalInfo', 'diagnoses', newDiags);
                                                            }}
                                                            className={`w-5 h-5 ${side==='R'?'accent-blue-600':'accent-green-600'}`}/>
                                                        <span className={`text-base font-bold ${side==='R'?'text-blue-700':'text-green-700'}`}>확인</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-2 py-1.5 rounded transition-colors">
                                                        <input type="radio" 
                                                            checked={diag.confirmedStatus[side] !== 'confirm'} 
                                                            onChange={() => {
                                                                const newDiags = activePatient.medicalInfo.diagnoses.map(d => d.id === diag.id ? { ...d, confirmedStatus: { ...d.confirmedStatus, [side]: 'none' } } : d);
                                                                updateActivePatientDeep('medicalInfo', 'diagnoses', newDiags);
                                                            }}
                                                            className="accent-slate-500 w-5 h-5"/>
                                                        <span className="text-base font-medium text-slate-600">미확인</span>
                                                    </label>
                                                </div>
                                            </div>

                                            <div className={`bg-white p-4 rounded border shadow-sm ${side==='R'?'border-blue-100':'border-green-100'}`}>
                                                <div className="text-xl font-black text-slate-800 mb-3 tracking-tight">업무관련성 평가</div>
                                                <div className="flex gap-4">
                                                    <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-2 py-1.5 rounded transition-colors">
                                                        <input type="radio" checked={diag.relevance[side] === 'high'} 
                                                            onChange={() => {
                                                                const newDiags = activePatient.medicalInfo.diagnoses.map(d => d.id === diag.id ? { ...d, relevance: { ...d.relevance, [side]: 'high' } } : d);
                                                                updateActivePatientDeep('medicalInfo', 'diagnoses', newDiags);
                                                            }} className={`w-5 h-5 ${side==='R'?'accent-blue-600':'accent-green-600'}`}/> 
                                                        <span className={`text-base font-bold ${side==='R'?'text-blue-700':'text-green-700'}`}>높음</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-2 py-1.5 rounded transition-colors">
                                                        <input type="radio" checked={diag.relevance[side] === 'low'} 
                                                            onChange={() => {
                                                                const newDiags = activePatient.medicalInfo.diagnoses.map(d => d.id === diag.id ? { ...d, relevance: { ...d.relevance, [side]: 'low' } } : d);
                                                                updateActivePatientDeep('medicalInfo', 'diagnoses', newDiags);
                                                            }} className="accent-slate-500 w-5 h-5"/> 
                                                        <span className="text-base font-medium text-slate-600">낮음</span>
                                                    </label>
                                                </div>
                                            </div>

                                            {diag.relevance[side] === 'low' && (
                                                <div className="mt-3 animate-fadeIn">
                                                    <div className={`text-sm font-bold mb-1 ${side==='R'?'text-blue-800':'text-green-800'}`}>낮음 사유</div>
                                                    <select className={`w-full text-base p-2.5 border rounded bg-white outline-none text-slate-700 mb-2 ${side==='R'?'focus:ring-1 focus:ring-blue-500':'focus:ring-1 focus:ring-green-500'}`}
                                                        value={diag.relevanceReason[side]} 
                                                        onChange={(e) => {
                                                            const newDiags = activePatient.medicalInfo.diagnoses.map(d => d.id === diag.id ? { ...d, relevanceReason: { ...d.relevanceReason, [side]: e.target.value } } : d);
                                                            updateActivePatientDeep('medicalInfo', 'diagnoses', newDiags);
                                                        }}>
                                                        {Object.entries(REASON_LABELS).map(([key, label]) => (
                                                            <option key={key} value={key}>{label}</option>
                                                        ))}
                                                    </select>
                                                    {diag.relevanceReason[side] === 'other' && (
                                                        <input type="text" className="w-full p-2 mt-2 border rounded text-sm focus:ring-1 focus:ring-slate-400 outline-none"
                                                            placeholder="상세 사유를 입력하세요"
                                                            value={diag.relevanceReasonText?.[side] || ''}
                                                            onChange={(e) => {
                                                                const newDiags = activePatient.medicalInfo.diagnoses.map(d => d.id === diag.id ? { 
                                                                    ...d, relevanceReasonText: { ...d.relevanceReasonText, [side]: e.target.value } 
                                                                    } : d);
                                                                updateActivePatientDeep('medicalInfo', 'diagnoses', newDiags);
                                                            }}/>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )})}

                        <div className="mt-4 pt-4 border-t">
                            <label className="block text-xs font-bold mb-2 text-slate-600">복귀 관련 고려사항</label>
                            <textarea className="w-full p-3 border rounded text-xs h-20 resize-none focus:ring-1 focus:ring-blue-500 outline-none" 
                                placeholder="복귀 시 고려사항을 입력하세요."
                                value={activePatient.assessment.returnConsideration} 
                                onChange={(e)=>updateActivePatientDeep('assessment', 'returnConsideration', e.target.value)}></textarea>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </main>

      {/* --- MOBILE STICKY BOTTOM BAR --- */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 lg:hidden shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-40 flex items-center justify-between safe-area-bottom">
          <div>
              <div className="text-[10px] text-slate-500 mb-0.5">누적 신체부담 (평균)</div>
              <div className="flex items-baseline gap-2">
                  <span className="font-extrabold text-xl text-blue-600 leading-none">
                      {activePatient.calculatedResult.avgRelevance.toFixed(1)}%
                  </span>
                  <span className={`text-sm font-bold ${activePatient.calculatedResult.judgment === '충분함' ? 'text-green-600' : 'text-red-500'}`}>
                      {activePatient.calculatedResult.judgment}
                  </span>
              </div>
          </div>
          <button onClick={scrollToResults} className="bg-blue-600 active:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-bold text-sm shadow-md transition-transform active:scale-95 flex items-center gap-1">
              결과 상세 <ChevronDown size={16}/>
          </button>
      </div>
    </div>
  );
}