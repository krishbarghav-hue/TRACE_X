import React, { useState, useEffect } from "react";
import { ArrowLeft, Plus, FolderTree, ExternalLink, Edit2, Trash2, FileText, StickyNote, Upload, Play, Square, CheckCircle, Save } from "lucide-react";
import { api } from "../api/api";
import ProgressBar from "../components/ProgressBar";

const TABS = ["Topics", "Resources", "Documents", "Notes", "Study"];

export default function CourseDetails({ courseId, onBack }) {
  const [course, setCourse] = useState(null);
  const [topics, setTopics] = useState([]);
  const [resources, setResources] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [notes, setNotes] = useState([]);
  const [courseAnalytics, setCourseAnalytics] = useState(null);
  const [progressMap, setProgressMap] = useState({});
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("Topics");
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicDesc, setNewTopicDesc] = useState("");
  const [newParentTopicId, setNewParentTopicId] = useState("");
  const [editingTopicProgress, setEditingTopicProgress] = useState(null);
  const [newPercent, setNewPercent] = useState(0);
  const [showEditCourse, setShowEditCourse] = useState(false);
  const [editCourseName, setEditCourseName] = useState("");
  const [editCourseDesc, setEditCourseDesc] = useState("");
  const [newNoteTopicId, setNewNoteTopicId] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [creatingNote, setCreatingNote] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [editNoteContent, setEditNoteContent] = useState("");
  const [noteError, setNoteError] = useState(null);
  const [showResForm, setShowResForm] = useState(false);
  const [resTitle, setResTitle] = useState("");
  const [resType, setResType] = useState("website");
  const [resUrl, setResUrl] = useState("");
  const [resDuration, setResDuration] = useState("");
  const [resTopicId, setResTopicId] = useState("");
  const [creatingRes, setCreatingRes] = useState(false);
  const [showDocForm, setShowDocForm] = useState(false);
  const [docFile, setDocFile] = useState(null);
  const [docTopicId, setDocTopicId] = useState("");
  const [docDesc, setDocDesc] = useState("");
  const [uploading, setUploading] = useState(false);
  const [docError, setDocError] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [studyTopicId, setStudyTopicId] = useState("");
  const [studyMode, setStudyMode] = useState("reading");
  const [studyNotes, setStudyNotes] = useState("");

  useEffect(() => { loadAll(); }, [courseId]);

  useEffect(() => {
    let t = null;
    if (activeSession) { t = setInterval(() => setElapsedSeconds((s) => s + 1), 1000); }
    else { setElapsedSeconds(0); }
    return () => clearInterval(t);
  }, [activeSession]);

  async function loadAll() {
    try {
      setLoading(true);
      const [cD, tD, rD, aD, pD, dD, nD, sD] = await Promise.all([
        api.getCourse(courseId),
        api.getTopicsByCourse(courseId),
        api.getResourcesByCourse(courseId).catch(() => []),
        api.getCourseAnalytics(courseId).catch(() => null),
        api.getProgressByCourse(courseId).catch(() => []),
        api.getDocumentsByCourse(courseId).catch(() => []),
        api.getNotesByCourse(courseId).catch(() => []),
        api.getStudySessionsByCourse(courseId).catch(() => []),
      ]);
      setCourse(cD); setTopics(tD || []); setResources(rD || []); setCourseAnalytics(aD);
      setDocuments(dD || []); setNotes(nD || []); setSessions(sD || []);
      const pMap = {};
      if (Array.isArray(pD)) pD.forEach((p) => { pMap[p.topic_id] = p; });
      setProgressMap(pMap);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleCreateTopic(e) {
    e.preventDefault();
    try {
      const c = await api.createTopic({ course_id: courseId, parent_topic_id: newParentTopicId ? parseInt(newParentTopicId) : null, topic_name: newTopicName.trim(), description: newTopicDesc.trim() || undefined });
      setTopics([...topics, c]); setNewTopicName(""); setNewTopicDesc(""); setNewParentTopicId(""); setShowTopicModal(false);
    } catch (err) { alert("Error: " + err.message); }
  }

  async function handleDeleteTopic(id) {
    if (!window.confirm("Delete this topic?")) return;
    try { await api.deleteTopic(id); setTopics(topics.filter((t) => t.topic_id !== id && t.parent_topic_id !== id)); }
    catch (err) { alert("Error: " + err.message); }
  }

  async function handleEditCourse(e) {
    e.preventDefault();
    try {
      const u = await api.updateCourse(courseId, { course_name: editCourseName.trim(), description: editCourseDesc.trim() || undefined });
      setCourse(u); setShowEditCourse(false);
    } catch (err) { alert("Error: " + err.message); }
  }

  async function handleDeleteCourse() {
    if (!window.confirm("Delete course and ALL its data? This cannot be undone.")) return;
    try { await api.deleteCourse(courseId); onBack(); }
    catch (err) { alert("Error: " + err.message); }
  }

  async function handleSaveProgress(e) {
    e.preventDefault();
    const topicId = editingTopicProgress.topic_id; const existing = progressMap[topicId]; const pct = parseInt(newPercent);
    try {
      if (existing) { const u = await api.updateProgress(existing.progress_id, { percent_complete: pct }); setProgressMap({ ...progressMap, [topicId]: u }); }
      else { const c = await api.createProgress({ topic_id: topicId, percent_complete: pct }); setProgressMap({ ...progressMap, [topicId]: c }); }
      setEditingTopicProgress(null);
    } catch (err) { alert("Error: " + err.message); }
  }

  async function handleAddResource(e) {
    e.preventDefault();
    try {
      setCreatingRes(true);
      const c = await api.createResource({ course_id: courseId, topic_id: resTopicId ? parseInt(resTopicId) : null, resource_type: resType, title: resTitle.trim(), url: resUrl.trim() || undefined, estimated_duration_minutes: resDuration ? parseInt(resDuration) : null });
      setResources([c, ...resources]); setResTitle(""); setResUrl(""); setResDuration(""); setResTopicId(""); setShowResForm(false);
    } catch (err) { alert("Error: " + err.message); }
    finally { setCreatingRes(false); }
  }

  async function handleDeleteResource(id) {
    if (!window.confirm("Delete this resource?")) return;
    try { await api.deleteResource(id); setResources(resources.filter((r) => r.resource_id !== id)); }
    catch (err) { alert("Error: " + err.message); }
  }

  async function handleUploadDocument(e) {
    e.preventDefault(); setDocError(null);
    try {
      setUploading(true);
      const fd = new FormData(); fd.append("course_id", courseId); if (docTopicId) fd.append("topic_id", docTopicId); if (docDesc) fd.append("description", docDesc); fd.append("file", docFile);
      const doc = await api.uploadDocument(fd); setDocuments([doc, ...documents]); setDocFile(null); setDocDesc(""); setDocTopicId(""); setShowDocForm(false);
    } catch (err) { setDocError(err.message); }
    finally { setUploading(false); }
  }

  async function handleDeleteDocument(id) {
    if (!window.confirm("Delete this document?")) return;
    try { await api.deleteDocument(id); setDocuments(documents.filter((d) => d.document_id !== id)); }
    catch (err) { alert("Error: " + err.message); }
  }

  async function handleCreateNote(e) {
    e.preventDefault(); setNoteError(null);
    try {
      setCreatingNote(true);
      const c = await api.createNote({ course_id: courseId, topic_id: parseInt(newNoteTopicId), content: newNoteContent.trim() });
      setNotes([c, ...notes]); setNewNoteContent(""); setNewNoteTopicId("");
    } catch (err) { setNoteError(err.message); }
    finally { setCreatingNote(false); }
  }

  async function handleUpdateNote(e) {
    e.preventDefault();
    try {
      const u = await api.updateNote(editingNote.note_id, { content: editNoteContent.trim() });
      setNotes(notes.map((n) => n.note_id === u.note_id ? u : n)); setEditingNote(null); setEditNoteContent("");
    } catch (err) { alert("Error: " + err.message); }
  }

  async function handleDeleteNote(id) {
    if (!window.confirm("Delete this note?")) return;
    try { await api.deleteNote(id); setNotes(notes.filter((n) => n.note_id !== id)); }
    catch (err) { alert("Error: " + err.message); }
  }

  async function handleStartStudy() {
    try {
      const s = await api.startStudySession({ course_id: courseId, topic_id: studyTopicId ? parseInt(studyTopicId) : null, study_mode: studyMode, session_notes: studyNotes || undefined });
      setActiveSession(s); setElapsedSeconds(0);
    } catch (err) { alert("Error: " + err.message); }
  }

  async function handleStopStudy() {
    if (!activeSession) return;
    try {
      const e = await api.endStudySession(activeSession.session_id, { session_notes: studyNotes || undefined });
      setActiveSession(null); setStudyNotes(""); setSessions([e, ...sessions]);
      const a = await api.getCourseAnalytics(courseId).catch(() => null); setCourseAnalytics(a);
    } catch (err) { alert("Error: " + err.message); }
  }

  function fmt(s) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sc = s % 60;
    return h > 0 ? `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sc).padStart(2,"0")}` : `${String(m).padStart(2,"0")}:${String(sc).padStart(2,"0")}`;
  }

  function tName(id) { const t = topics.find((t) => t.topic_id === parseInt(id)); return t ? t.topic_name : `Topic #${id}`; }

  const rootTopics = topics.filter((t) => !t.parent_topic_id);
  const getSubs = (pid) => topics.filter((t) => t.parent_topic_id === pid);
  const getRes = (tid) => resources.filter((r) => r.topic_id === tid);

  if (loading) return <div className="page-container"><p style={{color:"var(--text-muted)"}}>Loading course details...</p></div>;
  if (error || !course) return (
    <div className="page-container">
      <button className="btn btn-secondary" onClick={onBack} style={{marginBottom:"16px"}}><ArrowLeft size={16}/> Back</button>
      <div style={{background:"var(--danger-light)",border:"1px solid var(--danger)",padding:"12px 16px",borderRadius:"8px",color:"#fca5a5"}}>
        {error || "Course not found."}<br/><small>Make sure FastAPI is running on http://127.0.0.1:8000</small>
      </div>
    </div>
  );

  const ts = (tab) => ({ padding:"10px 18px",background:"transparent",border:"none", borderBottom: activeTab===tab?"2px solid var(--primary)":"2px solid transparent", color:activeTab===tab?"var(--primary)":"var(--text-muted)", fontWeight:activeTab===tab?700:500,fontSize:"14px",cursor:"pointer",marginBottom:"-1px",transition:"all 0.15s" });

  return (
    <div className="page-container">
      <button className="btn btn-secondary" onClick={onBack} style={{marginBottom:"20px"}}><ArrowLeft size={16}/> Back to Courses</button>

      {/* Banner */}
      <div className="card-section" style={{borderLeft:"4px solid var(--primary)",marginBottom:"24px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"16px"}}>
          <div style={{flex:1}}>
            <span style={{fontSize:"12px",fontWeight:700,color:"var(--primary)",textTransform:"uppercase"}}>COURSE #{course.course_id}</span>
            <h1 style={{fontSize:"26px",fontWeight:800,margin:"4px 0 6px 0"}}>{course.course_name}</h1>
            <p style={{color:"var(--text-muted)",fontSize:"14px"}}>{course.description || "No description provided."}</p>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:"8px",alignItems:"flex-end"}}>
            <div style={{display:"flex",gap:"8px"}}>
              <button className="btn btn-secondary" style={{padding:"6px 12px",fontSize:"12px"}} onClick={() => { setEditCourseName(course.course_name); setEditCourseDesc(course.description||""); setShowEditCourse(true); }}>
                <Edit2 size={13}/> Edit
              </button>
              <button className="btn btn-danger" style={{padding:"6px 12px",fontSize:"12px"}} onClick={handleDeleteCourse}>
                <Trash2 size={13}/> Delete
              </button>
            </div>
            <div style={{display:"flex",gap:"14px",background:"var(--bg-surface)",padding:"12px 16px",borderRadius:"var(--radius-md)",border:"1px solid var(--border-color)"}}>
              {[["var(--primary)",courseAnalytics?.total_study_minutes||0,"m","Study Time"],["var(--sky)",courseAnalytics?.total_sessions||0,"","Sessions"],["var(--success)",courseAnalytics?.average_progress||0,"%","Progress"]].map(([color,val,unit,label],i) => (
                <React.Fragment key={i}>
                  {i>0&&<div style={{width:"1px",background:"var(--border-color)"}}/>}
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:"18px",fontWeight:800,color}}>{val}{unit}</div>
                    <div style={{fontSize:"10px",color:"var(--text-dim)",textTransform:"uppercase"}}>{label}</div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",marginBottom:"24px",borderBottom:"1px solid var(--border-color)"}}>
        {TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={ts(tab)}>
            {tab}{tab==="Notes"&&notes.length>0&&<span style={{marginLeft:6,background:"var(--primary-light)",color:"var(--primary)",borderRadius:"9999px",padding:"1px 7px",fontSize:"11px"}}>{notes.length}</span>}
          </button>
        ))}
      </div>

      {/* TOPICS */}
      {activeTab==="Topics"&&(
        <div className="card-section">
          <div className="section-head">
            <div className="section-title"><FolderTree size={20} color="var(--primary)"/><span>Topics &amp; Subtopics</span></div>
            <button className="btn btn-primary" onClick={() => setShowTopicModal(true)}><Plus size={16}/> Add Topic</button>
          </div>
          {topics.length===0?<p style={{color:"var(--text-dim)",fontSize:"14px"}}>No topics yet. Click "Add Topic" to start.</p>:(
            <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
              {rootTopics.map((parent) => {
                const subs=getSubs(parent.topic_id); const pr=getRes(parent.topic_id); const prog=progressMap[parent.topic_id]?.percent_complete||0; const st=progressMap[parent.topic_id]?.status||"not_started";
                return (
                  <div key={parent.topic_id} style={{background:"var(--bg-surface)",border:"1px solid var(--border-color)",borderRadius:"var(--radius-md)",padding:"16px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"10px",marginBottom:"6px"}}>
                      <div style={{flex:1}}>
                        <h3 style={{fontSize:"16px",fontWeight:700}}>{parent.topic_name}</h3>
                        {parent.description&&<p style={{fontSize:"12px",color:"var(--text-muted)",margin:"2px 0"}}>{parent.description}</p>}
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",flexShrink:0}}>
                        <div style={{width:"100px"}}><ProgressBar percent={prog}/></div>
                        <span style={{fontSize:"10px",color:st==="completed"?"var(--success)":"var(--text-dim)",textTransform:"uppercase",fontWeight:600}}>{st.replace("_"," ")}</span>
                        <button className="btn btn-secondary" style={{padding:"4px 8px",fontSize:"11px"}} onClick={() => { setEditingTopicProgress(parent); setNewPercent(prog); }}><Edit2 size={11}/> Progress</button>
                        <button style={{background:"transparent",border:"none",color:"var(--danger)",cursor:"pointer",padding:"3px"}} onClick={() => handleDeleteTopic(parent.topic_id)}><Trash2 size={13}/></button>
                      </div>
                    </div>
                    {pr.length>0&&<div style={{margin:"6px 0 10px 10px",display:"flex",flexWrap:"wrap",gap:"6px"}}>{pr.map((r)=><a key={r.resource_id} href={r.url||"#"} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:"4px",background:"var(--bg-card)",padding:"3px 8px",borderRadius:"4px",fontSize:"11px",color:"var(--sky)",border:"1px solid var(--border-color)"}}><ExternalLink size={10}/>{r.title}</a>)}</div>}
                    {subs.length>0&&(
                      <div style={{marginLeft:"18px",borderLeft:"2px dashed var(--border-color)",paddingLeft:"12px",display:"flex",flexDirection:"column",gap:"8px",marginTop:"8px"}}>
                        {subs.map((child)=>{
                          const cr=getRes(child.topic_id); const cp=progressMap[child.topic_id]?.percent_complete||0; const cs=progressMap[child.topic_id]?.status||"not_started";
                          return (
                            <div key={child.topic_id} style={{background:"var(--bg-card)",padding:"10px 14px",borderRadius:"8px",border:"1px solid var(--border-color)"}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"8px"}}>
                                <div style={{flex:1}}>
                                  <h4 style={{fontSize:"13px",fontWeight:600}}>&rarr; {child.topic_name}</h4>
                                  {child.description&&<span style={{fontSize:"11px",color:"var(--text-muted)"}}>{child.description}</span>}
                                </div>
                                <div style={{display:"flex",alignItems:"center",gap:"6px",flexShrink:0}}>
                                  <div style={{width:"80px"}}><ProgressBar percent={cp}/></div>
                                  <span style={{fontSize:"10px",color:cs==="completed"?"var(--success)":"var(--text-dim)",textTransform:"uppercase",fontWeight:600}}>{cs.replace("_"," ")}</span>
                                  <button className="btn btn-secondary" style={{padding:"3px 7px",fontSize:"10px"}} onClick={() => { setEditingTopicProgress(child); setNewPercent(cp); }}>Update</button>
                                  <button style={{background:"transparent",border:"none",color:"var(--danger)",cursor:"pointer",padding:"2px"}} onClick={() => handleDeleteTopic(child.topic_id)}><Trash2 size={12}/></button>
                                </div>
                              </div>
                              {cr.length>0&&<div style={{marginTop:"6px",display:"flex",flexWrap:"wrap",gap:"5px"}}>{cr.map((r)=><a key={r.resource_id} href={r.url||"#"} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:"3px",background:"var(--bg-surface)",padding:"2px 6px",borderRadius:"4px",fontSize:"10px",color:"var(--sky)",border:"1px solid var(--border-color)"}}><ExternalLink size={9}/>{r.title}</a>)}</div>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* RESOURCES */}
      {activeTab==="Resources"&&(
        <div className="card-section">
          <div className="section-head">
            <div className="section-title"><ExternalLink size={18} color="var(--sky)"/><span>Resources ({resources.length})</span></div>
            <button className="btn btn-primary" onClick={() => setShowResForm(!showResForm)}><Plus size={16}/> {showResForm?"Cancel":"Add Resource"}</button>
          </div>
          {showResForm&&(
            <form onSubmit={handleAddResource} style={{background:"var(--bg-surface)",padding:"18px",borderRadius:"10px",marginBottom:"20px",border:"1px solid var(--border-color)"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:"12px"}}>
                <div><label style={{display:"block",fontSize:"12px",fontWeight:600,marginBottom:"6px"}}>Type *</label>
                  <select className="input-control" value={resType} onChange={(e)=>setResType(e.target.value)}>
                    <option value="youtube">YouTube Video</option><option value="website">Website</option><option value="documentation">Documentation</option><option value="article">Article</option><option value="pdf">Web PDF</option><option value="ppt">Slides</option><option value="other">Other</option>
                  </select>
                </div>
                <div><label style={{display:"block",fontSize:"12px",fontWeight:600,marginBottom:"6px"}}>Topic</label>
                  <select className="input-control" value={resTopicId} onChange={(e)=>setResTopicId(e.target.value)}>
                    <option value="">Course-Level</option>{topics.map((t)=><option key={t.topic_id} value={t.topic_id}>{t.topic_name}</option>)}
                  </select>
                </div>
                <div><label style={{display:"block",fontSize:"12px",fontWeight:600,marginBottom:"6px"}}>Duration (min)</label>
                  <input type="number" min="0" className="input-control" placeholder="e.g. 45" value={resDuration} onChange={(e)=>setResDuration(e.target.value)}/>
                </div>
              </div>
              <label style={{display:"block",fontSize:"12px",fontWeight:600,marginBottom:"6px"}}>Title *</label>
              <input type="text" className="input-control" placeholder="e.g. SQL Tutorial" value={resTitle} onChange={(e)=>setResTitle(e.target.value)} required/>
              <label style={{display:"block",fontSize:"12px",fontWeight:600,marginBottom:"6px"}}>URL</label>
              <input type="url" className="input-control" placeholder="https://..." value={resUrl} onChange={(e)=>setResUrl(e.target.value)}/>
              <button type="submit" className="btn btn-primary" disabled={creatingRes}>{creatingRes?"Saving...":"Add Resource"}</button>
            </form>
          )}
          {resources.length===0?<p style={{color:"var(--text-dim)",fontSize:"14px"}}>No resources added yet.</p>:(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"12px"}}>
              {resources.map((res)=>(
                <div key={res.resource_id} style={{background:"var(--bg-surface)",border:"1px solid var(--border-color)",borderRadius:"8px",padding:"14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <span style={{fontSize:"11px",textTransform:"uppercase",color:"var(--sky)",fontWeight:700}}>{res.resource_type}</span>
                    <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                      {res.estimated_duration_minutes&&<span style={{fontSize:"11px",color:"var(--text-dim)"}}>~{res.estimated_duration_minutes}m</span>}
                      <button style={{background:"transparent",border:"none",color:"var(--danger)",cursor:"pointer",padding:"2px"}} onClick={()=>handleDeleteResource(res.resource_id)}><Trash2 size={13}/></button>
                    </div>
                  </div>
                  <h4 style={{fontSize:"14px",fontWeight:700,margin:"5px 0 3px 0"}}>{res.title}</h4>
                  {res.topic_id&&<div style={{fontSize:"11px",color:"var(--text-muted)",marginBottom:"6px"}}>Topic: {tName(res.topic_id)}</div>}
                  {res.url&&<a href={res.url} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"12px",color:"var(--primary)"}}><ExternalLink size={11}/> Open Resource</a>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DOCUMENTS */}
      {activeTab==="Documents"&&(
        <div className="card-section">
          <div className="section-head">
            <div className="section-title"><Upload size={18} color="var(--primary)"/><span>Documents ({documents.length})</span></div>
            <button className="btn btn-primary" onClick={() => setShowDocForm(!showDocForm)}><Plus size={16}/> {showDocForm?"Cancel":"Upload Document"}</button>
          </div>
          {showDocForm&&(
            <form onSubmit={handleUploadDocument} style={{background:"var(--bg-surface)",padding:"18px",borderRadius:"10px",marginBottom:"20px",border:"1px solid var(--border-color)"}}>
              {docError&&<div style={{background:"var(--danger-light)",border:"1px solid var(--danger)",padding:"10px",borderRadius:"8px",color:"#fca5a5",fontSize:"13px",marginBottom:"12px"}}>{docError}</div>}
              <label style={{display:"block",fontSize:"12px",fontWeight:600,marginBottom:"6px"}}>Topic (Optional)</label>
              <select className="input-control" value={docTopicId} onChange={(e)=>setDocTopicId(e.target.value)}>
                <option value="">None (Course-Level)</option>{topics.map((t)=><option key={t.topic_id} value={t.topic_id}>{t.topic_name}</option>)}
              </select>
              <label style={{display:"block",fontSize:"12px",fontWeight:600,marginBottom:"6px"}}>File (PDF, PPT, PPTX, DOC, DOCX, TXT) *</label>
              <input type="file" className="input-control" accept=".pdf,.ppt,.pptx,.doc,.docx,.txt" onChange={(e)=>setDocFile(e.target.files[0]||null)} required/>
              <label style={{display:"block",fontSize:"12px",fontWeight:600,marginBottom:"6px"}}>Description</label>
              <input type="text" className="input-control" placeholder="e.g. Midterm revision notes" value={docDesc} onChange={(e)=>setDocDesc(e.target.value)}/>
              <button type="submit" className="btn btn-primary" disabled={uploading}>{uploading?"Uploading...":"Upload Document"}</button>
            </form>
          )}
          {documents.length===0?<p style={{color:"var(--text-dim)",fontSize:"14px"}}>No documents uploaded yet.</p>:(
            <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
              {documents.map((doc)=>(
                <div key={doc.document_id} style={{background:"var(--bg-surface)",border:"1px solid var(--border-color)",borderRadius:"8px",padding:"14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"12px",flex:1}}>
                    <div style={{width:"38px",height:"38px",borderRadius:"8px",background:"var(--primary-light)",color:"var(--primary)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><FileText size={18}/></div>
                    <div>
                      <div style={{fontWeight:600,fontSize:"14px"}}>{doc.file_name}</div>
                      <div style={{fontSize:"11px",color:"var(--text-muted)",marginTop:"2px"}}>
                        {doc.file_type?.toUpperCase()} &bull; {Math.round((doc.file_size_bytes||0)/1024)} KB
                        {doc.topic_id&&` \u2022 ${tName(doc.topic_id)}`}
                        {doc.uploaded_at&&` \u2022 ${new Date(doc.uploaded_at).toLocaleDateString()}`}
                      </div>
                      {doc.description&&<div style={{fontSize:"11px",color:"var(--text-dim)",marginTop:"2px"}}>{doc.description}</div>}
                    </div>
                  </div>
                  <button style={{background:"transparent",border:"none",color:"var(--danger)",cursor:"pointer",padding:"6px",flexShrink:0}} onClick={()=>handleDeleteDocument(doc.document_id)}><Trash2 size={15}/></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* NOTES */}
      {activeTab==="Notes"&&(
        <div className="card-section">
          <div className="section-head"><div className="section-title"><StickyNote size={18} color="var(--warning)"/><span>Notes ({notes.length})</span></div></div>
          <form onSubmit={handleCreateNote} style={{background:"var(--bg-surface)",padding:"18px",borderRadius:"10px",marginBottom:"24px",border:"1px solid var(--border-color)"}}>
            <h4 style={{fontSize:"14px",fontWeight:700,marginBottom:"12px"}}>Write a New Note</h4>
            {noteError&&<div style={{background:"var(--danger-light)",border:"1px solid var(--danger)",padding:"10px",borderRadius:"8px",color:"#fca5a5",fontSize:"13px",marginBottom:"12px"}}>{noteError}</div>}
            <label style={{display:"block",fontSize:"12px",fontWeight:600,marginBottom:"6px"}}>Topic *</label>
            <select className="input-control" value={newNoteTopicId} onChange={(e)=>setNewNoteTopicId(e.target.value)} required>
              <option value="">-- Select Topic --</option>{topics.map((t)=><option key={t.topic_id} value={t.topic_id}>{t.topic_name}</option>)}
            </select>
            <label style={{display:"block",fontSize:"12px",fontWeight:600,marginBottom:"6px"}}>Content *</label>
            <textarea className="input-control" rows={5} placeholder="Write your study notes..." value={newNoteContent} onChange={(e)=>setNewNoteContent(e.target.value)} required style={{resize:"vertical"}}/>
            <button type="submit" className="btn btn-primary" disabled={creatingNote||!newNoteTopicId}>{creatingNote?"Saving...":"Save Note"}</button>
          </form>
          {notes.length===0?<p style={{color:"var(--text-dim)",fontSize:"14px"}}>No notes yet.</p>:(
            <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
              {notes.map((note)=>(
                <div key={note.note_id} style={{background:"var(--bg-surface)",border:"1px solid var(--border-color)",borderLeft:"3px solid var(--warning)",borderRadius:"8px",padding:"14px"}}>
                  {editingNote?.note_id===note.note_id?(
                    <form onSubmit={handleUpdateNote}>
                      <textarea className="input-control" rows={5} value={editNoteContent} onChange={(e)=>setEditNoteContent(e.target.value)} required autoFocus style={{resize:"vertical"}}/>
                      <div style={{display:"flex",gap:"8px",marginTop:"6px"}}>
                        <button type="submit" className="btn btn-primary" style={{padding:"6px 14px",fontSize:"13px"}}><Save size={12}/> Save</button>
                        <button type="button" className="btn btn-secondary" style={{padding:"6px 14px",fontSize:"13px"}} onClick={()=>setEditingNote(null)}>Cancel</button>
                      </div>
                    </form>
                  ):(
                    <>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
                        <div style={{fontSize:"12px",color:"var(--text-muted)"}}>
                          <span style={{color:"var(--warning)",fontWeight:600}}>Topic: {tName(note.topic_id)}</span>
                          {note.created_at&&` \u2022 ${new Date(note.created_at).toLocaleString()}`}
                        </div>
                        <div style={{display:"flex",gap:"5px"}}>
                          <button style={{background:"transparent",border:"none",color:"var(--sky)",cursor:"pointer",padding:"3px"}} onClick={()=>{setEditingNote(note);setEditNoteContent(note.content);}}><Edit2 size={13}/></button>
                          <button style={{background:"transparent",border:"none",color:"var(--danger)",cursor:"pointer",padding:"3px"}} onClick={()=>handleDeleteNote(note.note_id)}><Trash2 size={13}/></button>
                        </div>
                      </div>
                      <p style={{fontSize:"14px",color:"var(--text-main)",whiteSpace:"pre-wrap",lineHeight:"1.6",margin:0}}>{note.content}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STUDY */}
      {activeTab==="Study"&&(
        <>
          {activeSession?(
            <div className="timer-banner" style={{flexDirection:"column",alignItems:"center",gap:"16px",textAlign:"center"}}>
              <div>
                <span style={{fontSize:"12px",fontWeight:700,color:"var(--sky)",textTransform:"uppercase",letterSpacing:"1px"}}>&#9679; STUDY SESSION IN PROGRESS</span>
                <div style={{fontSize:"13px",color:"var(--text-muted)",marginTop:"4px"}}>{course.course_name}{activeSession.topic_id?` / ${tName(activeSession.topic_id)}`:""}</div>
                <div className="timer-digits" style={{fontSize:"52px",margin:"12px 0"}}>{fmt(elapsedSeconds)}</div>
                <div style={{color:"var(--text-muted)",fontSize:"13px"}}>Mode: <strong>{activeSession.study_mode}</strong></div>
              </div>
              <button className="btn btn-danger" style={{padding:"14px 32px",fontSize:"16px"}} onClick={handleStopStudy}><Square size={18}/> STOP STUDY</button>
            </div>
          ):(
            <div className="card-section">
              <div className="section-head"><div className="section-title"><Play size={18} color="var(--primary)"/><span>Start Study Session</span></div></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"16px",marginBottom:"16px"}}>
                <div><label style={{display:"block",fontSize:"13px",fontWeight:600,marginBottom:"6px"}}>Topic (Optional)</label>
                  <select className="input-control" value={studyTopicId} onChange={(e)=>setStudyTopicId(e.target.value)}>
                    <option value="">None (General)</option>{topics.map((t)=><option key={t.topic_id} value={t.topic_id}>{t.topic_name}</option>)}
                  </select>
                </div>
                <div><label style={{display:"block",fontSize:"13px",fontWeight:600,marginBottom:"6px"}}>Study Mode</label>
                  <select className="input-control" value={studyMode} onChange={(e)=>setStudyMode(e.target.value)}>
                    <option value="reading">Reading</option><option value="video">Video Watching</option><option value="practice">Hands-On Practice</option><option value="revision">Exam Revision</option><option value="other">Other</option>
                  </select>
                </div>
              </div>
              <label style={{display:"block",fontSize:"13px",fontWeight:600,marginBottom:"6px"}}>Session Goal / Notes</label>
              <input type="text" className="input-control" placeholder="e.g. Completing exercises for Joins..." value={studyNotes} onChange={(e)=>setStudyNotes(e.target.value)} style={{marginBottom:"20px"}}/>
              <button className="btn btn-success" style={{padding:"12px 24px",fontSize:"15px"}} onClick={handleStartStudy}><Play size={18}/> START STUDY</button>
            </div>
          )}
          <div className="card-section" style={{marginTop:"20px"}}>
            <div className="section-head"><div className="section-title"><CheckCircle size={18} color="var(--success)"/><span>Session History ({sessions.length})</span></div></div>
            {sessions.length===0?<p style={{color:"var(--text-dim)",fontSize:"14px"}}>No sessions yet.</p>:(
              <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                {sessions.slice(0,10).map((s)=>(
                  <div key={s.session_id} style={{background:"var(--bg-surface)",border:"1px solid var(--border-color)",borderRadius:"8px",padding:"12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"3px"}}>
                        <span style={{fontSize:"11px",textTransform:"uppercase",background:"var(--primary-light)",color:"var(--primary)",padding:"2px 7px",borderRadius:"4px",fontWeight:700}}>{s.study_mode}</span>
                        {s.topic_id&&<span style={{fontSize:"12px",color:"var(--text-muted)"}}>{tName(s.topic_id)}</span>}
                      </div>
                      {s.session_notes&&<p style={{fontSize:"12px",color:"var(--text-muted)",margin:"2px 0"}}>{s.session_notes}</p>}
                      <span style={{fontSize:"11px",color:"var(--text-dim)"}}>{new Date(s.start_time).toLocaleString()}</span>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:"18px",fontWeight:800,color:"var(--success)"}}>{s.duration_minutes||0}m</div>
                      <span style={{fontSize:"11px",color:"var(--text-dim)"}}>Duration</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── MODALS ── */}
      {showTopicModal&&(
        <div style={{position:"fixed",inset:0,backgroundColor:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:"20px"}}>
          <div style={{background:"var(--bg-card)",border:"1px solid var(--border-color)",borderRadius:"var(--radius-lg)",width:"100%",maxWidth:"480px",padding:"28px"}}>
            <h3 style={{fontSize:"20px",fontWeight:700,marginBottom:"16px"}}>Add Topic / Subtopic</h3>
            <form onSubmit={handleCreateTopic}>
              <label style={{display:"block",fontSize:"13px",fontWeight:600,marginBottom:"6px"}}>Parent Topic (Optional)</label>
              <select className="input-control" value={newParentTopicId} onChange={(e)=>setNewParentTopicId(e.target.value)}>
                <option value="">None (Top-Level)</option>{topics.map((t)=><option key={t.topic_id} value={t.topic_id}>{t.topic_name}</option>)}
              </select>
              <label style={{display:"block",fontSize:"13px",fontWeight:600,marginBottom:"6px"}}>Topic Name *</label>
              <input type="text" className="input-control" placeholder="e.g. SQL, Normalization" value={newTopicName} onChange={(e)=>setNewTopicName(e.target.value)} required autoFocus/>
              <label style={{display:"block",fontSize:"13px",fontWeight:600,marginBottom:"6px"}}>Description</label>
              <textarea className="input-control" rows={2} value={newTopicDesc} onChange={(e)=>setNewTopicDesc(e.target.value)}/>
              <div style={{display:"flex",justifyContent:"flex-end",gap:"12px",marginTop:"4px"}}>
                <button type="button" className="btn btn-secondary" onClick={()=>setShowTopicModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Topic</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingTopicProgress&&(
        <div style={{position:"fixed",inset:0,backgroundColor:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:"20px"}}>
          <div style={{background:"var(--bg-card)",border:"1px solid var(--border-color)",borderRadius:"var(--radius-lg)",width:"100%",maxWidth:"420px",padding:"28px"}}>
            <h3 style={{fontSize:"18px",fontWeight:700,marginBottom:"8px"}}>Update Progress</h3>
            <p style={{color:"var(--text-muted)",fontSize:"13px",marginBottom:"16px"}}>Setting progress for <strong>{editingTopicProgress.topic_name}</strong></p>
            <form onSubmit={handleSaveProgress}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"8px",fontSize:"14px",fontWeight:600}}><span>Completion:</span><span style={{color:"var(--primary)"}}>{newPercent}%</span></div>
              <input type="range" min="0" max="100" step="5" value={newPercent} onChange={(e)=>setNewPercent(e.target.value)} style={{width:"100%",marginBottom:"24px",cursor:"pointer"}}/>
              <div style={{display:"flex",justifyContent:"flex-end",gap:"12px"}}>
                <button type="button" className="btn btn-secondary" onClick={()=>setEditingTopicProgress(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Progress</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditCourse&&(
        <div style={{position:"fixed",inset:0,backgroundColor:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:"20px"}}>
          <div style={{background:"var(--bg-card)",border:"1px solid var(--border-color)",borderRadius:"var(--radius-lg)",width:"100%",maxWidth:"480px",padding:"28px"}}>
            <h3 style={{fontSize:"20px",fontWeight:700,marginBottom:"16px"}}>Edit Course</h3>
            <form onSubmit={handleEditCourse}>
              <label style={{display:"block",fontSize:"13px",fontWeight:600,marginBottom:"6px"}}>Course Name *</label>
              <input type="text" className="input-control" value={editCourseName} onChange={(e)=>setEditCourseName(e.target.value)} required autoFocus/>
              <label style={{display:"block",fontSize:"13px",fontWeight:600,marginBottom:"6px"}}>Description</label>
              <textarea className="input-control" rows={3} value={editCourseDesc} onChange={(e)=>setEditCourseDesc(e.target.value)}/>
              <div style={{display:"flex",justifyContent:"flex-end",gap:"12px",marginTop:"4px"}}>
                <button type="button" className="btn btn-secondary" onClick={()=>setShowEditCourse(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
