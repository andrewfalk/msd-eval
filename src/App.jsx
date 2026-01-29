import React, { useState, useEffect, useRef } from 'react';
import { Save, FolderOpen, RefreshCw, FileDown, Plus, Trash2, Info, Activity, User, Briefcase, Calculator, FileText, CheckSquare, Stethoscope, X, Eye, Upload, ChevronDown } from 'lucide-react';

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

const AUX_FACTORS = [
  { id: 'stairs', label: '계단 오르내리기' },
  { id: 'twisting', label: '무릎 비틀림' },
  { id: 'startStop', label: '출발/정지 반복' },
  { id: 'narrow', label: '좁은 공간' },
  { id: 'impact', label: '무릎 접촉/충격' },
  { id: 'jump', label: '뛰어내리기' },
];

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
        id: Date.now() + 1, code: '', name: '', side: 'R', 
        klgGrade: { R: '0', L: '0' },
        confirmedStatus: { R: 'confirm', L: 'confirm' }, 
        relevance: { R: 'low', L: 'low' }, 
        relevanceReason: { R: 'unrelated', L: 'unrelated' } 
      }
    ],
    notes: ''
  },
  jobs: [
    { 
      id: Date.now() + 2, jobName: '', startDate: '', endDate: '', duration: 0, weight: 0, squatting: 0, burden: determineBurdenLevel(0,0),
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

        let updatedJobs = p.jobs.map(job => {
            const burden = determineBurdenLevel(Number(job.weight), Number(job.squatting));
            let duration = job.duration;
            if (job.startDate && job.endDate) {
                const start = new Date(job.startDate);
                const end = new Date(job.endDate);
                const diffTime = Math.abs(end - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                duration = (diffDays / 365.25).toFixed(2);
            }
            if (job.duration === duration && job.burden.level === burden.level) return job;
            return { ...job, duration, burden };
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
  }, [JSON.stringify(patients.map(p => ({ b: p.basicInfo, j: p.jobs })))]); 

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
    const updatedJobs = activePatient.jobs.map(job => 
        job.id === jobId ? { ...job, [field]: value } : job
    );
    updateActivePatient('jobs', updatedJobs);
  };

  const addJob = () => {
    const newJob = { 
        id: Date.now(), jobName: '', startDate: '', endDate: '', duration: 0, weight: 0, squatting: 0, burden: determineBurdenLevel(0,0),
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
    if (!window.XLSX) { alert("엑셀 라이브러리 로딩 중..."); return; }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target.result;
      const workbook = window.XLSX.read(data, { type: 'binary' });
      const newImportedPatients = [];

      workbook.SheetNames.forEach((sheetName, idx) => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
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
                     p.jobs.push({
                         id: Date.now() + idx + i, 
                         jobName: jobRow[0],
                         startDate: jobRow[1] || '',
                         endDate: jobRow[2] || '',
                         duration: jobRow[3] ? String(jobRow[3]).replace(/[^0-9.]/g, '') : 0,
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
    if (!window.XLSX) return;
    const wb = window.XLSX.utils.book_new();
    
    patients.forEach(p => {
        const wsData = [];
        const merges = [];
        
        wsData.push(["업무관련성 특별진찰 소견서(근골격계질병 - 무릎)"]);
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
            const sides = d.side === 'B' ? '양측' : d.side === 'R' ? '우측' : '좌측';
            const confirmedStr = d.side === 'B' 
                ? `우측(${d.confirmedStatus.R === 'confirm' ? '확인' : '미확인'})/좌측(${d.confirmedStatus.L === 'confirm' ? '확인' : '미확인'})` 
                : d.side === 'R' ? `우측(${d.confirmedStatus.R === 'confirm' ? '확인' : '미확인'})` : `좌측(${d.confirmedStatus.L === 'confirm' ? '확인' : '미확인'})`;
            let klgInfo = "";
            if (d.side === 'R') klgInfo = `KL(우):${getKlgText(d.klgGrade.R)}`;
            else if (d.side === 'L') klgInfo = `KL(좌):${getKlgText(d.klgGrade.L)}`;
            else klgInfo = `KL(우):${getKlgText(d.klgGrade.R)}/KL(좌):${getKlgText(d.klgGrade.L)}`;
            return `[신청] ${d.code} ${d.name}(${sides}) -> [확인] ${confirmedStr} [${klgInfo}]`; 
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
                job.jobName, job.startDate, job.endDate, `${job.duration}년`,
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

        wsData.push(["4. 종합 소견"]);
        merges.push({ s: { r: wsData.length-1, c: 0 }, e: { r: wsData.length-1, c: 7 } });
        const burdenText = `${p.calculatedResult.minRelevance}% ~ ${p.calculatedResult.maxRelevance}% (평균 ${p.calculatedResult.avgRelevance.toFixed(1)}%)\n판정: ${p.calculatedResult.judgment}`;
        wsData.push(["누적부담평가", burdenText]);
        merges.push({ s: { r: wsData.length-1, c: 1 }, e: { r: wsData.length-1, c: 7 } });
        
        const opinionText = p.medicalInfo.diagnoses.map(d => {
            let res = `${d.name}: `;
            if(d.side === 'B' || d.side === 'R') res += `우측(${d.relevance.R === 'high' ? '높음' : '낮음'}) `;
            if(d.side === 'B' || d.side === 'L') res += `좌측(${d.relevance.L === 'high' ? '높음' : '낮음'}) `;
            let reasons = [];
            if ((d.side === 'B' || d.side === 'R') && d.relevance.R === 'low') reasons.push(`우측사유: ${d.relevanceReason.R}`);
            if ((d.side === 'B' || d.side === 'L') && d.relevance.L === 'low') reasons.push(`좌측사유: ${d.relevanceReason.L}`);
            if(reasons.length > 0) res += ` [${reasons.join(', ')}]`;
            return res;
        }).join("\n");
        wsData.push(["최종소견", opinionText]);
        merges.push({ s: { r: wsData.length-1, c: 1 }, e: { r: wsData.length-1, c: 7 } });
        wsData.push(["복귀 고려사항", p.assessment.returnConsideration]);
        merges.push({ s: { r: wsData.length-1, c: 1 }, e: { r: wsData.length-1, c: 7 } });

        const ws = window.XLSX.utils.aoa_to_sheet(wsData);
        ws['!merges'] = merges;
        ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 20 }];
        
        const safeName = (p.basicInfo.name || p.name || 'Sheet').replace(/[*/?:[\]]/g, '');
        window.XLSX.utils.book_append_sheet(wb, ws, safeName.substring(0, 30));
    });

    window.XLSX.writeFile(wb, `업무관련성평가_통합_${new Date().toISOString().slice(0,10)}.xlsx`);
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
      {/* --- HEADER --- */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4">
            <div className="h-14 flex items-center justify-between">
                <div className="flex items-center gap-2 shrink-0">
                    <Activity className="text-blue-600" size={24} />
                    <h1 className="text-lg font-bold text-slate-800 hidden md:block">근골격계 질환 업무관련성 평가 <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded">v2.3 (Mobile)</span></h1>
                    <h1 className="text-lg font-bold text-slate-800 md:hidden">업무관련성 평가 v2.3</h1>
                </div>
                
                {/* Scrollable Toolbar for Mobile */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv, .xlsx, .xls" className="hidden" />
                    <button onClick={() => fileInputRef.current.click()} className="flex items-center gap-1 px-3 py-1.5 text-xs text-blue-800 hover:bg-blue-100 rounded border border-blue-200 bg-blue-50 font-bold whitespace-nowrap"><Upload size={14}/> <span className="hidden md:inline">엑셀 일괄입력</span></button>
                    <button onClick={() => setShowPreview(true)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded border border-slate-200 whitespace-nowrap"><Eye size={14}/> <span className="hidden md:inline">미리보기</span></button>
                    <button onClick={handleLoad} className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded whitespace-nowrap"><FolderOpen size={14}/> <span className="hidden md:inline">불러오기</span></button>
                    <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded font-medium whitespace-nowrap"><Save size={14}/> <span className="hidden md:inline">저장</span></button>
                    <button onClick={handleExportXLSX} disabled={!isExcelReady} className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded font-medium border whitespace-nowrap ${isExcelReady ? 'text-green-700 hover:bg-green-50 border-green-200' : 'text-gray-400 border-gray-200 cursor-not-allowed'}`}>
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

      {/* --- PREVIEW MODAL --- */}
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
                             const sides = d.side === 'B' ? '양측' : d.side === 'R' ? '우측' : '좌측';
                             const confirmedStr = d.side === 'B' 
                                ? `우측(${d.confirmedStatus.R === 'confirm' ? '확인' : '미확인'})/좌측(${d.confirmedStatus.L === 'confirm' ? '확인' : '미확인'})` 
                                : d.side === 'R' ? `우측(${d.confirmedStatus.R === 'confirm' ? '확인' : '미확인'})` : `좌측(${d.confirmedStatus.L === 'confirm' ? '확인' : '미확인'})`;
                             let klgInfo = "";
                             if (d.side === 'R') klgInfo = `KL(우):${getKlgText(d.klgGrade.R)}`;
                             else if (d.side === 'L') klgInfo = `KL(좌):${getKlgText(d.klgGrade.L)}`;
                             else klgInfo = `KL(우):${getKlgText(d.klgGrade.R)}/KL(좌):${getKlgText(d.klgGrade.L)}`;
                             return <div key={i} className="mb-1 border-b border-slate-200 pb-1 last:border-0">[신청] {d.code} {d.name}({sides}) → [확인] {confirmedStr} <span className="text-blue-600 font-bold">[{klgInfo}]</span></div>
                          })}
                        </td>
                     </tr>
                     <tr>
                        <th className="border border-slate-400 bg-slate-100 p-2">특이사항</th>
                        <td className="border border-slate-400 p-2" colSpan="7">{activePatient.medicalInfo.notes}</td>
                     </tr>
                   </tbody>
                 </table>

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
                             <td className="border border-slate-400 p-2">{job.duration}년</td>
                             <td className="border border-slate-400 p-2">{job.evidence.health ? 'V' : ''}</td>
                             <td className="border border-slate-400 p-2">{job.evidence.employ ? 'V' : ''}</td>
                             <td className="border border-slate-400 p-2">{job.evidence.income ? 'V' : ''}</td>
                             <td className="border border-slate-400 p-2">{job.evidence.etc ? 'V' : ''}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>

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
                       <tr>
                          <th className="border border-slate-400 bg-slate-100 p-2">최종소견</th>
                          <td className="border border-slate-400 p-2">
                             {activePatient.medicalInfo.diagnoses.map((d, i) => {
                                let res = `${d.name}: `;
                                if(d.side === 'B' || d.side === 'R') res += `우측(${d.relevance.R === 'high' ? '높음' : '낮음'}) `;
                                if(d.side === 'B' || d.side === 'L') res += `좌측(${d.relevance.L === 'high' ? '높음' : '낮음'}) `;
                                return <div key={i} className="mb-1 last:mb-0">{res}</div>
                             })}
                          </td>
                       </tr>
                       <tr>
                          <th className="border border-slate-400 bg-slate-100 p-2">복귀 고려사항</th>
                          <td className="border border-slate-400 p-2">{activePatient.assessment.returnConsideration}</td>
                       </tr>
                    </tbody>
                 </table>
                 
                 <div className="text-center text-slate-500 mt-8 text-[10px]">
                    * 현재 선택된 탭의 환자 정보입니다. 엑셀 저장 시에는 모든 탭의 데이터가 시트별로 저장됩니다.
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
                </section>

                <section className="bg-white p-4 md:p-5 rounded-lg shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4 border-b pb-2">
                        <div className="flex items-center gap-2 text-blue-800">
                            <FileText size={20}/>
                            <h2 className="font-bold text-lg">2. 의학 정보 (신청)</h2>
                        </div>
                        <button onClick={() => {
                            const newDiag = { 
                                id: Date.now(), code: '', name: '', side: 'R', 
                                klgGrade: { R: '0', L: '0' }, confirmedStatus: { R: 'confirm', L: 'confirm' }, relevance: { R: 'low', L: 'low' }, relevanceReason: { R: 'unrelated', L: 'unrelated' } 
                            };
                            updateActivePatientDeep('medicalInfo', 'diagnoses', [...activePatient.medicalInfo.diagnoses, newDiag]);
                        }} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 flex items-center gap-1">
                            <Plus size={12}/> 상병 추가
                        </button>
                    </div>
                    <div className="space-y-4">
                        {activePatient.medicalInfo.diagnoses.map((diag, idx) => (
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
                                <div className="flex gap-4 text-sm bg-white p-2 rounded border border-blue-100">
                                    <span className="text-xs font-bold text-slate-500 pt-0.5">신청 부위:</span>
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
                            </div>
                        ))}
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
                                    <div className="absolute top-4 right-4 text-xs font-bold px-2 py-1 rounded bg-white border shadow-sm">Job #{index + 1}</div>
                                    
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
                                    
                                    <div className="mt-3 flex justify-between items-center text-sm border-t pt-2">
                                        <div className="text-slate-500 text-xs">근무기간: <span className="font-bold text-slate-800">{job.duration || 0} 년</span></div>
                                        <div className={`font-bold ${burden.color}`}>신체부담: {burden.level} ({burden.minScore}~{burden.maxScore})</div>
                                    </div>
                                    {activePatient.jobs.length > 1 && <button onClick={()=>removeJob(job.id)} className="absolute bottom-4 right-4 text-red-400 hover:text-red-600"><Trash2 size={16}/></button>}
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
                        
                        {activePatient.medicalInfo.diagnoses.map((diag, idx) => (
                            <div key={diag.id} className="border-2 border-slate-200 rounded-xl p-5 bg-white shadow-sm hover:border-blue-300 transition-colors">
                                <div className="mb-4">
                                    <div className="text-lg font-extrabold text-indigo-900 mb-3 flex items-center gap-2">
                                        <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-full">#{idx + 1}</span>
                                        {diag.name || '(진단명 미입력)'} 
                                        <span className="text-sm font-medium text-slate-500 ml-1">({diag.side === 'B' ? '양측' : diag.side === 'R' ? '우측' : '좌측'})</span>
                                    </div>
                                    <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100 flex gap-4">
                                        {['R', 'L'].map(side => (
                                            (diag.side === side || diag.side === 'B') && (
                                                <div key={side} className="flex-1">
                                                    <label className="block text-xs font-bold text-indigo-800 mb-1">{side==='R'?'우측':'좌측'} KL grade</label>
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
                                            )
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    {['R', 'L'].map(side => (
                                        (diag.side === side || diag.side === 'B') && (
                                            <div key={side} className={`p-4 rounded border ${side==='R' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className={`text-sm font-extrabold ${side==='R'?'text-blue-900':'text-green-900'}`}>{side==='R'?'우측 (Right)':'좌측 (Left)'}</span>
                                                </div>
                                                
                                                <div className={`bg-white p-4 rounded border shadow-sm mb-3 ${side==='R'?'border-blue-100':'border-green-100'}`}>
                                                    <div className="text-xl font-black text-slate-800 mb-3 tracking-tight">상병 확인</div>
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
                                                        <select className={`w-full text-base p-2.5 border rounded bg-white outline-none text-slate-700 ${side==='R'?'focus:ring-1 focus:ring-blue-500':'focus:ring-1 focus:ring-green-500'}`}
                                                            value={diag.relevanceReason[side]} 
                                                            onChange={(e) => {
                                                                const newDiags = activePatient.medicalInfo.diagnoses.map(d => d.id === diag.id ? { ...d, relevanceReason: { ...d.relevanceReason, [side]: e.target.value } } : d);
                                                                updateActivePatientDeep('medicalInfo', 'diagnoses', newDiags);
                                                            }}>
                                                            <option value="unrelated">신체부담과 무관 (외상 등)</option>
                                                            <option value="mild">연령 대비 퇴행성 변화 경미</option>
                                                            <option value="expired">업무 중단 후 상당기간 경과</option>
                                                            <option value="other">기타 의학적 소견</option>
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    ))}
                                </div>
                            </div>
                        ))}

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