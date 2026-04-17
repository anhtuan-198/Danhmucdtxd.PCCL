import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Settings, RefreshCw, FilePlus, Database, Download, ExternalLink, AlertCircle, X, ChevronDown, Eye, Lock, User as UserIcon, LogIn, LogOut, Filter } from 'lucide-react';
import { EVN_HCMC_LOGO } from "./assets/logo";

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1B237SBdWeaQvc0GWH7hwcJI9ztiSxdBxXFbN4nBnxzU/export?format=csv&gid=0';
const PROJECTS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1B237SBdWeaQvc0GWH7hwcJI9ztiSxdBxXFbN4nBnxzU/export?format=csv&gid=1152018861'; // Using gid for 'Thông tin theo MCT' if known, or gviz. Let's use gviz to be safe.
const PROJECTS_GVIZ_URL = 'https://docs.google.com/spreadsheets/d/1B237SBdWeaQvc0GWH7hwcJI9ztiSxdBxXFbN4nBnxzU/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent('Thông tin theo MCT');
const USERS_GVIZ_URL = 'https://docs.google.com/spreadsheets/d/1B237SBdWeaQvc0GWH7hwcJI9ztiSxdBxXFbN4nBnxzU/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent('user');

const PROXY_URL = `https://corsproxy.io/?${encodeURIComponent(SHEET_CSV_URL)}`;
const PROJECTS_PROXY_URL = `https://corsproxy.io/?${encodeURIComponent(PROJECTS_GVIZ_URL)}`;
const USERS_PROXY_URL = `https://corsproxy.io/?${encodeURIComponent(USERS_GVIZ_URL)}`;

const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzM2LkJuvFJJDK6br3ZWlPELN1ZhXaglrnts173Zp_Oqxg5kHsLLuBoVtBGoujHoZhmig/exec';

interface User {
  FullName: string;
  username: string;
  AllowedProjects: string;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('currentUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [users, setUsers] = useState<any[]>([]);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [data, setData] = useState<string[][]>([]);
  const [projectInfo, setProjectInfo] = useState<Record<string, string>>({});
  const [availableProjects, setAvailableProjects] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scriptUrl, setScriptUrl] = useState(localStorage.getItem('appsScriptUrl') || DEFAULT_SCRIPT_URL);
  const [showSettings, setShowSettings] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const clickCountRef = useRef(0);
  const lastClickTimeRef = useRef(0);
  const projectNameRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (projectNameRef.current) {
      projectNameRef.current.style.height = 'auto';
      projectNameRef.current.style.height = `${projectNameRef.current.scrollHeight}px`;
    }
  }, [projectInfo["Tên dự án/công trình"], projectSearchTerm, showDropdown]);

  const handleLogoClick = () => {
    const now = Date.now();
    if (now - lastClickTimeRef.current < 500) {
      clickCountRef.current += 1;
    } else {
      clickCountRef.current = 1;
    }
    lastClickTimeRef.current = now;

    if (clickCountRef.current >= 5) {
      setShowSettings(prev => !prev);
      clickCountRef.current = 0;
    }
  };

  useEffect(() => {
    fetchUsers();
    
    // Handle click outside for custom dropdown
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser]);

  const fetchUsers = async () => {
    try {
      const timestamp = new Date().getTime();
      const urlWithCacheBuster = `${USERS_GVIZ_URL}&t=${timestamp}`;
      let response;
      try {
        response = await fetch(urlWithCacheBuster);
        if (!response.ok) throw new Error('Direct fetch failed');
      } catch (e) {
        try {
          response = await fetch(`${USERS_PROXY_URL}&t=${timestamp}`);
          if (!response.ok) throw new Error('Proxy fetch failed');
        } catch (e2) {
          response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(urlWithCacheBuster)}`);
        }
      }
      if (response && response.ok) {
        const csvText = await response.text();
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setUsers(results.data);
          }
        });
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);

    // Simulate a small delay for better UX
    setTimeout(() => {
      const user = users.find(u => u.username === loginForm.username && u.Password === loginForm.password);
      if (user) {
        const userData = {
          FullName: user.FullName,
          username: user.username,
          AllowedProjects: user.AllowedProjects || ''
        };
        setCurrentUser(userData);
        localStorage.setItem('currentUser', JSON.stringify(userData));
        setLoginForm({ username: '', password: '' });
      } else {
        setLoginError('Tên đăng nhập hoặc mật khẩu không chính xác.');
      }
      setIsLoggingIn(false);
    }, 800);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    setProjectInfo({});
    setData([]);
  };

  const fetchData = async (expectedProjectCode?: string, retries = 0) => {
    setLoading(true);
    setError(null);
    try {
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      const urlWithCacheBuster = `${SHEET_CSV_URL}&t=${timestamp}`;
      
      // 1. Fetch CSV data first
      let response;
      let fetchError = null;
      
      try {
        response = await fetch(urlWithCacheBuster);
        if (!response.ok) throw new Error(`Direct fetch failed: ${response.status}`);
      } catch (e) {
        fetchError = e;
        try {
          response = await fetch(`${PROXY_URL}&t=${timestamp}`);
          if (!response.ok) throw new Error(`Proxy fetch failed: ${response.status}`);
        } catch (e2) {
          fetchError = e2;
          try {
            response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(urlWithCacheBuster)}`);
            if (!response.ok) throw new Error(`AllOrigins fetch failed: ${response.status}`);
          } catch (e3) {
            fetchError = e3;
            // One last try with another proxy
            try {
              response = await fetch(`https://thingproxy.freeboard.io/fetch/${encodeURIComponent(urlWithCacheBuster)}`);
              if (!response.ok) throw new Error(`ThingProxy fetch failed: ${response.status}`);
            } catch (e4) {
              fetchError = e4;
              throw new Error('Không thể kết nối với dữ liệu Google Sheet. Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.');
            }
          }
        }
      }
      
      if (!response || !response.ok) {
        throw new Error('Không thể tải dữ liệu từ Google Sheet.');
      }
      
      const csvText = await response.text();
      
      // 2. Parse CSV immediately to check for project code match
      let csvResults: Papa.ParseResult<string[]> | null = null;
      Papa.parse(csvText, {
        complete: (results) => {
            csvResults = results as Papa.ParseResult<string[]>;
        }
      });
      
      if (!csvResults || !csvResults.data) throw new Error('Failed to parse CSV');
      
      const allRows = csvResults.data as string[][];
      
      // Extract Project Info from rows 7-13 (approx)
      const info: Record<string, string> = {};
      for (let i = 7; i <= 13; i++) {
        if (allRows[i] && allRows[i][0]) {
          info[allRows[i][0].replace(':', '').trim()] = allRows[i][2] || '';
        }
      }

      // Check if the fetched data matches the expected project
      const fetchedProjectCode = info["Mã công trình"];
      
      if (expectedProjectCode && fetchedProjectCode !== expectedProjectCode) {
        if (retries > 0) {
            console.log(`Mismatch: Expected ${expectedProjectCode}, got ${fetchedProjectCode}. Retrying... (${retries} left)`);
            setTimeout(() => fetchData(expectedProjectCode, retries - 1), 300);
            return;
        }

        console.warn(`Mismatch: Expected ${expectedProjectCode}, got ${fetchedProjectCode}`);
        // Data mismatch - likely Apps Script failed to update or data is empty
        // We show empty state instead of stale data
        setData([]);
        setLoading(false);
        // We don't overwrite projectInfo here because we want to keep what the user selected
        return;
      }
      
      // Reorder the keys as requested
      const orderedInfo: Record<string, string> = {};
      const desiredOrder = [
        "Tên dự án/công trình",
        "Mã công trình",
        "Chủ Đầu Tư",
        "Địa điểm xây dựng",
        "Đơn vị TV Thiết Kế",
        "Đơn vị TV Giám sát",
        "Đơn vị thi công"
      ];
      
      desiredOrder.forEach(key => {
        if (info[key] !== undefined) {
          orderedInfo[key] = info[key];
        }
      });
      
      // Add any remaining keys
      Object.keys(info).forEach(key => {
        if (orderedInfo[key] === undefined) {
          orderedInfo[key] = info[key];
        }
      });

      setProjectInfo(orderedInfo);
      
      // Fetch available projects
      fetchProjects(orderedInfo);

      // Extract table data (from row 15 onwards)
      // Row 15 is header, 16+ is data
      const tableData = allRows.slice(15).filter(row => row.some(cell => cell.trim() !== ''));
      
      // Update UI immediately with CSV data (without links)
      setData([...tableData]);
      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      // 3. Match found! Now fetch HTML version IN THE BACKGROUND to extract links
      // We don't block the UI for this
      (async () => {
        let htmlText = '';
        try {
          const htmlUrl = 'https://docs.google.com/spreadsheets/d/1B237SBdWeaQvc0GWH7hwcJI9ztiSxdBxXFbN4nBnxzU/htmlview/sheet?headers=true&gid=0';
          let htmlResponse;
          try {
            htmlResponse = await fetch(htmlUrl);
            if (!htmlResponse.ok) throw new Error('Direct fetch failed');
          } catch (e) {
            try {
              htmlResponse = await fetch(`https://corsproxy.io/?${encodeURIComponent(htmlUrl)}`);
              if (!htmlResponse.ok) throw new Error('Proxy fetch failed');
            } catch (e2) {
              htmlResponse = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(htmlUrl)}`);
            }
          }
          if (htmlResponse && htmlResponse.ok) {
            htmlText = await htmlResponse.text();
          }
        } catch (e) {
          console.warn('Could not fetch HTML version for links');
        }
        
        // Parse HTML to extract links if available
        const linkMap = new Map<string, string>();
        if (htmlText) {
          // Parse the table structure
          try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            const rows = doc.querySelectorAll('table tbody tr');
            
            rows.forEach(row => {
              const cells = row.querySelectorAll('td');
              // Usually column 1 is Tên văn bản
              if (cells.length > 1) {
                const textCell = cells[1];
                const textContent = textCell.textContent?.replace(/\s+/g, ' ').trim();
                
                // Find the link anywhere in the row
                const linkElement = row.querySelector('a');
                
                if (textContent && linkElement && linkElement.href) {
                  let href = linkElement.href;
                  if (href.includes('google.com/url?')) {
                    try {
                      const urlParams = new URLSearchParams(href.split('?')[1]);
                      const q = urlParams.get('q');
                      if (q) href = q;
                    } catch (e) {
                      // Ignore parsing errors
                    }
                  }
                  linkMap.set(textContent, href);
                }
              }
            });
            console.log(`Extracted ${linkMap.size} links from HTML`);
          } catch (e) {
            console.warn('Error parsing HTML table', e);
          }
        }
        
        // 4. Apply extracted links to the data and update state again
        if (linkMap.size > 0) {
          setData(prevData => {
            // Safety check: if data was cleared or changed significantly (e.g. user selected another project), don't apply links
            if (prevData.length === 0 || (tableData.length > 0 && prevData[0] && prevData[0][1] !== tableData[0][1])) {
              return prevData;
            }
            
            const newData = [...prevData];
            let updated = false;
            for (let i = 0; i < newData.length; i++) {
              if (newData[i] && newData[i][5]?.trim().toLowerCase() === 'xem file') {
                const textToMatch = newData[i][1]?.replace(/\s+/g, ' ').trim();
                if (textToMatch && linkMap.has(textToMatch)) {
                  newData[i] = [...newData[i]]; // Clone row
                  newData[i][5] = linkMap.get(textToMatch)!;
                  updated = true;
                }
              }
            }
            return updated ? newData : prevData;
          });
        }
      })();

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchProjects = async (currentProjectInfo: Record<string, string>) => {
    try {
      let response;
      const timestamp = new Date().getTime();
      const urlWithCacheBuster = `${PROJECTS_GVIZ_URL}&t=${timestamp}`;
      
      try {
        response = await fetch(urlWithCacheBuster);
        if (!response.ok) throw new Error('Direct fetch failed');
      } catch (e) {
        try {
          response = await fetch(`${PROJECTS_PROXY_URL}&t=${timestamp}`);
          if (!response.ok) throw new Error('Proxy fetch failed');
        } catch (e2) {
          try {
            response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(urlWithCacheBuster)}`);
            if (!response.ok) throw new Error('AllOrigins fetch failed');
          } catch (e3) {
            // One last try
            response = await fetch(`https://thingproxy.freeboard.io/fetch/${encodeURIComponent(urlWithCacheBuster)}`);
            if (!response.ok) throw new Error('ThingProxy fetch failed');
          }
        }
      }
      
      const csvText = await response.text();
      Papa.parse(csvText, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as string[][];
          const projects: Record<string, string>[] = [];
          
          // The sheet "Thông tin theo MCT" structure:
          // Col 0: STT
          // Col 1: Mã công trình
          // Col 2: Tên công trình
          // Col 3: Địa điểm xây dựng
          // Col 4: Chủ đầu tư
          // Col 5: Đơn vị TV Thiết Kế
          // Col 6: Đơn vị TV Giám sát
          // Col 7: Đơn vị thi công
          
          // Start from row 1 (skipping header)
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const projectCode = row[1]?.trim() || "";
            
            // Filter projects based on user role
            if (currentUser) {
              const allowedProjects = currentUser.AllowedProjects.split(';').map(p => p.trim()).filter(p => p !== '');
              if (allowedProjects.length > 0 && !allowedProjects.includes(projectCode)) {
                continue;
              }
            }

            if (row && row.length >= 3 && row[2] && row[2].trim() !== "" && row[2] !== "Tên công trình") {
              projects.push({
                "Tên dự án/công trình": row[2].trim(),
                "Mã công trình": projectCode,
                "Chủ Đầu Tư": row[4]?.trim() || "",
                "Địa điểm xây dựng": row[3]?.trim() || "",
                "Đơn vị TV Thiết Kế": row[5]?.trim() || "",
                "Đơn vị TV Giám sát": row[6]?.trim() || "",
                "Đơn vị thi công": row[7]?.trim() || ""
              });
            }
          }
          
          // Ensure current project is in the list if not already
          const currentName = currentProjectInfo["Tên dự án/công trình"];
          if (currentName && !projects.some(p => p["Tên dự án/công trình"] === currentName)) {
            projects.unshift(currentProjectInfo);
          }
          
          // Remove duplicates by name
          const uniqueProjects = projects.filter((v, i, a) => 
            a.findIndex(t => t["Tên dự án/công trình"] === v["Tên dự án/công trình"]) === i
          );
          
          setAvailableProjects(uniqueProjects);
        }
      });
    } catch (err) {
      console.error("Failed to fetch projects list:", err);
      setAvailableProjects([currentProjectInfo]);
    }
  };

  const saveScriptUrl = (url: string) => {
    setScriptUrl(url);
    localStorage.setItem('appsScriptUrl', url);
  };

  const triggerAction = async (actionName: string, actionId: string, params: Record<string, string> = {}) => {
    if (!scriptUrl) {
      alert('Vui lòng cấu hình Apps Script Web App URL trong phần Cài đặt trước khi thực hiện chức năng này.');
      setShowSettings(true);
      return;
    }

    setActionLoading(actionId);
    try {
      const url = new URL(scriptUrl);
      url.searchParams.append('action', actionId);
      
      // Append any additional parameters
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
      
      // We use no-cors because Apps Script Web Apps often have CORS issues unless configured properly.
      // With no-cors, the browser won't let us read the response, but the request DOES reach the server.
      await fetch(url.toString(), { mode: 'no-cors' });
      
      // Start polling almost immediately, as the Apps Script might be fast
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // If we are updating project info, we expect the sheet to reflect this project
      if (actionId === 'updateProjectInfo' && params["Mã công trình"]) {
        // Use more frequent retries (30 attempts * 300ms = 9s max) to catch the update as soon as it happens
        fetchData(params["Mã công trình"], 30);
      } else {
        fetchData();
      }
      
    } catch (err: any) {
      console.error(err);
      alert(`Lỗi khi thực hiện "${actionName}": Vui lòng kiểm tra lại kết nối hoặc URL Apps Script.`);
    } finally {
      setActionLoading(null);
    }
  };

  // Clean up data for display
  const displayData = data.filter(row => row.some(cell => cell.trim() !== ''));
  const headers = displayData.length > 0 ? displayData[0] : [];
  const allRows = displayData.length > 1 ? displayData.slice(1) : [];

  // Identify sections and assign rows to them
  const sections: string[] = [];
  const rowToSectionMap = new Map<number, string>();
  let currentSection = "";

  allRows.forEach((row, index) => {
    const isSectionHeader = row[1] && !row[3] && !row[4] && !row[5] && !row[6];
    if (isSectionHeader) {
      currentSection = row[1];
      if (!sections.includes(currentSection)) {
        sections.push(currentSection);
      }
    }
    rowToSectionMap.set(index, currentSection);
  });

  const rows = allRows.filter((row, index) => {
    const matchesSearch = row.some(cell => cell.toLowerCase().includes(searchTerm.toLowerCase()));
    const sectionOfRow = rowToSectionMap.get(index) || "";
    const matchesSection = selectedSection === 'all' || sectionOfRow === selectedSection;
    
    // If it's a section header, we always show it if it matches search OR if it's the selected section
    const isSectionHeader = row[1] && !row[3] && !row[4] && !row[5] && !row[6];
    if (isSectionHeader) {
      return (selectedSection === 'all' || row[1] === selectedSection) && matchesSearch;
    }

    return matchesSearch && matchesSection;
  });

  // Further filter rows to hide those in collapsed sections
  const visibleRows = rows.filter((row, index) => {
    const isSectionHeader = row[1] && !row[3] && !row[4] && !row[5] && !row[6];
    if (isSectionHeader) return true;
    
    const sectionOfRow = rowToSectionMap.get(allRows.indexOf(row));
    return !sectionOfRow || !collapsedSections.has(sectionOfRow);
  });

  const toggleSection = (sectionName: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionName)) {
        next.delete(sectionName);
      } else {
        next.add(sectionName);
      }
      return next;
    });
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          <div className="bg-white p-8 text-center border-b border-slate-100">
            <div className="inline-block mb-4 cursor-default select-none">
              <img 
                src={EVN_HCMC_LOGO} 
                alt="EVN HCMC" 
                className="h-24 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <h1 className="text-blue-900 text-2xl font-bold uppercase tracking-wider">Đăng nhập hệ thống</h1>
            <p className="text-slate-500 mt-2 text-sm font-medium">Quản lý danh mục ĐTXD</p>
          </div>
          
          <form onSubmit={handleLogin} className="p-8 space-y-6">
            {loginError && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{loginError}</p>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tên đăng nhập</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text"
                    required
                    value={loginForm.username}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-800"
                    placeholder="Nhập tên đăng nhập..."
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Mật khẩu</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="password"
                    required
                    value={loginForm.password}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-800"
                    placeholder="Nhập mật khẩu..."
                  />
                </div>
              </div>
            </div>
            
            <button 
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-blue-900 text-white py-3.5 rounded-xl font-bold uppercase tracking-widest hover:bg-blue-800 active:scale-[0.98] transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isLoggingIn ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <LogIn className="w-5 h-5" />
              )}
              <span>Đăng nhập</span>
            </button>
          </form>
          
          <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">© 2026 EVN HCMC - Hệ thống quản lý nội bộ</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center cursor-pointer select-none" onClick={handleLogoClick} title="EVN HCMC">
              <img 
                src={EVN_HCMC_LOGO} 
                alt="EVN HCMC" 
                className="h-16 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-blue-900 uppercase tracking-tight">QUẢN LÝ DANH MỤC ĐTXD</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-sm font-bold text-slate-700">{currentUser.FullName}</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">@{currentUser.username}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2.5 bg-slate-100 text-slate-600 rounded-full hover:bg-red-50 hover:text-red-600 transition-all border border-slate-200"
              title="Đăng xuất"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col h-[90vh]">
              <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-slate-800 uppercase">Nhập dữ liệu</h3>
                </div>
                <button 
                  onClick={() => {
                    setShowImportModal(false);
                    fetchData();
                  }}
                  className="p-2 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-700 transition-all"
                  title="Đóng cửa sổ"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden relative bg-slate-100">
                <iframe 
                  src={scriptUrl} 
                  className="w-full h-full border-none"
                  title="Apps Script Form"
                />
              </div>
              <div className="px-6 py-4 border-t border-slate-200 flex justify-end bg-slate-50">
                <button 
                  onClick={() => {
                    setShowImportModal(false);
                    fetchData();
                  }}
                  className="px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition-colors shadow-md"
                >
                  HOÀN TẤT
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8 animate-in slide-in-from-top-4 fade-in duration-200">
            <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-500" />
              Cấu hình kết nối Google Apps Script
            </h2>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-sm text-amber-800 flex gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">Tại sao cần cấu hình URL này?</p>
                <p className="mb-2">Để các nút chức năng hoạt động, bạn cần triển khai mã Apps Script trên Google Sheet của bạn dưới dạng <strong>Web App</strong> và dán URL vào đây.</p>
                <ol className="list-decimal ml-5 space-y-1">
                  <li>Mở Google Sheet, vào <strong>Tiện ích mở rộng &gt; Apps Script</strong>.</li>
                  <li>Thêm hàm <code>doGet(e)</code> để xử lý các tham số <code>action</code> ('create', 'import', 'export').</li>
                  <li>Chọn <strong>Triển khai &gt; Triển khai mới</strong>, chọn loại <strong>Ứng dụng web</strong>.</li>
                  <li>Quyền truy cập: <strong>Bất kỳ ai</strong>.</li>
                  <li>Sao chép URL Web App và dán vào ô bên dưới.</li>
                </ol>
              </div>
            </div>
            <div className="flex gap-3">
              <input 
                type="url" 
                value={scriptUrl}
                onChange={(e) => saveScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow"
              />
              <button 
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-medium transition-colors"
              >
                Lưu & Đóng
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="hidden sm:block mb-8 bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="grid grid-cols-2 sm:flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <button 
              onClick={() => {
                if (!scriptUrl) {
                  alert('Vui lòng cấu hình Apps Script Web App URL trong phần Cài đặt trước khi thực hiện chức năng này.');
                  setShowSettings(true);
                  return;
                }
                setShowImportModal(true);
              }}
              className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 px-3 py-2.5 sm:px-6 sm:py-3 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 font-bold shadow-sm hover:shadow-md active:scale-95 transition-all duration-200"
            >
              <FilePlus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="uppercase tracking-wider text-[10px] sm:text-sm">Nhập dữ liệu</span>
            </button>
            
            <button 
              onClick={() => {
                try {
                  // Create a new workbook
                  const wb = XLSX.utils.book_new();
                  
                  // Prepare data for the worksheet
                  const wsData = [];
                  
                  // Add Project Info
                  Object.entries(projectInfo).forEach(([key, value]) => {
                    wsData.push([key, '', value]);
                  });
                  
                  // Add an empty row
                  wsData.push([]);
                  
                  // Add Table Headers
                  wsData.push(['STT', 'TÊN VĂN BẢN', '', 'SỐ VB', 'NGÀY VB', 'FILE VB', 'CƠ QUAN BAN HÀNH']);
                  
                  // Add Table Data
                  data.forEach(row => {
                    wsData.push(row);
                  });
                  
                  // Create worksheet
                  const ws = XLSX.utils.aoa_to_sheet(wsData);
                  
                  // Add worksheet to workbook
                  XLSX.utils.book_append_sheet(wb, ws, "Danh mục hồ sơ");
                  
                  // Generate filename
                  const projectCode = projectInfo["Mã công trình"] || "Unknown";
                  const filename = `Danh mục hồ sơ - ${projectCode}.xlsx`;
                  
                  // Save the file
                  XLSX.writeFile(wb, filename);
                } catch (error) {
                  console.error('Error generating Excel file:', error);
                  alert('Có lỗi xảy ra khi tạo file Excel. Vui lòng thử lại.');
                }
              }}
              className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 px-3 py-2.5 sm:px-6 sm:py-3 bg-white text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-50 font-bold shadow-sm hover:shadow-md active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="uppercase tracking-wider text-[10px] sm:text-sm">Tải xuống</span>
            </button>
          </div>
        </div>

        {/* Project Info */}
        {Object.keys(projectInfo).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">Thông tin dự án</h2>
            <div className="flex flex-col gap-y-3">
              {Object.entries(projectInfo).map(([key, value], idx) => {
                if (key === 'Tên dự án/công trình') {
                  return (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                      <span className="text-slate-500 font-medium min-w-[160px] pt-1.5">{key}:</span>
                      <div className="relative flex-1 max-w-4xl" ref={dropdownRef}>
                        <textarea 
                          ref={projectNameRef}
                          value={showDropdown ? projectSearchTerm : value}
                          onFocus={() => {
                            setProjectSearchTerm('');
                            setShowDropdown(true);
                          }}
                          onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = `${target.scrollHeight}px`;
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                            }
                          }}
                          onChange={(e) => {
                            setProjectSearchTerm(e.target.value);
                          }}
                          className="w-full pl-3 pr-10 py-1.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-slate-800 font-semibold resize-none overflow-hidden"
                          placeholder="Nhập từ khoá để tìm kiếm..."
                          rows={1}
                        />
                        {((showDropdown && projectSearchTerm) || (!showDropdown && value)) && (
                          <button 
                            onClick={() => {
                              if (showDropdown) {
                                setProjectSearchTerm('');
                              } else {
                                setProjectInfo(prev => ({...prev, "Tên dự án/công trình": ""}));
                                setProjectSearchTerm('');
                                setShowDropdown(true);
                              }
                            }}
                            className="absolute right-3 top-2 p-1 text-slate-400 hover:text-slate-600"
                            title="Xoá"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        
                        {showDropdown && (
                          <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-80 overflow-y-auto">
                            {availableProjects
                              .filter(p => !projectSearchTerm || String(p["Tên dự án/công trình"]).toLowerCase().includes(projectSearchTerm.toLowerCase()))
                              .map((p, i) => (
                                <div 
                                  key={i}
                                  className="px-4 py-2 hover:bg-emerald-50 cursor-pointer text-sm text-slate-700 border-b border-slate-50 last:border-0 leading-relaxed"
                                  onClick={() => {
                                    setProjectInfo(p);
                                    setData([]);
                                    setLoading(true);
                                    setShowDropdown(false);
                                    setProjectSearchTerm('');
                                    if (scriptUrl) {
                                      triggerAction('Cập nhật Thông tin dự án', 'updateProjectInfo', p);
                                    } else {
                                      alert('Vui lòng cài đặt Apps Script Web App URL (biểu tượng bánh răng góc trên bên phải) để có thể đồng bộ dữ liệu lên Google Sheet.');
                                      setLoading(false);
                                    }
                                  }}
                                >
                                  {p["Tên dự án/công trình"]}
                                </div>
                              ))}
                            {availableProjects.filter(p => !projectSearchTerm || String(p["Tên dự án/công trình"]).toLowerCase().includes(projectSearchTerm.toLowerCase())).length === 0 && (
                              <div className="px-4 py-3 text-sm text-slate-400 italic">Không tìm thấy dự án phù hợp</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                    <span className="text-slate-500 font-medium min-w-[160px]">{key}:</span>
                    <span className="text-slate-800 font-semibold">{value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex justify-between items-center gap-4 w-full lg:w-auto">
              <h2 className="font-semibold text-slate-800 shrink-0 uppercase tracking-wider text-sm">DANH MỤC HỒ SƠ</h2>
              
              <div className="flex items-center gap-2 lg:hidden">
                <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full whitespace-nowrap">
                  {visibleRows.length} dòng
                </span>
                <button 
                  onClick={() => setShowMobileFilters(!showMobileFilters)}
                  className={`p-2 rounded-lg border transition-all relative ${
                    showMobileFilters || selectedSection !== 'all' 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                      : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'
                  }`}
                  title="Lọc theo mục"
                >
                  <Filter className="w-4 h-4" />
                  {selectedSection !== 'all' && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full border border-white"></span>
                  )}
                </button>
              </div>
            </div>

            {/* Search and Filters Area */}
            <div className={`${showMobileFilters ? 'flex' : 'hidden'} lg:flex flex-col lg:flex-row lg:items-center gap-3 w-full lg:w-auto`}>
              {/* Section Filter - Toggleable on mobile, always visible on desktop */}
              <div className="relative w-full lg:w-64">
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white appearance-none pr-10"
                >
                  <option value="all">Tất cả các mục</option>
                  {sections.map((section, idx) => (
                    <option key={idx} value={section}>{section}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>

              {/* Search - Always visible on desktop, toggleable with filters on mobile if needed, but user wanted it outside on mobile before */}
              {/* Actually, let's keep search always visible as per previous request, but align it nicely */}
              <div className="relative w-full lg:w-64">
                <input
                  type="text"
                  placeholder="Tìm kiếm nội dung..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3 pr-9 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none w-full"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    title="Xoá tìm kiếm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <span className="hidden lg:inline-flex text-xs font-medium text-slate-500 bg-slate-200 px-2.5 py-1 rounded-full whitespace-nowrap">
                {visibleRows.length} dòng
              </span>
            </div>
          </div>
          
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin mb-4 text-emerald-600" />
              <p>Đang tải dữ liệu ...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Lỗi khi tải dữ liệu</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto max-h-[600px]">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="text-xs text-slate-600 uppercase bg-white sticky top-0 z-10 shadow-sm text-center">
                    <tr>
                      {/* Custom headers based on the CSV structure we saw */}
                      <th className="px-4 py-3 font-semibold border-b border-slate-200">STT</th>
                      <th className="px-4 py-3 font-semibold border-b border-slate-200">TÊN VĂN BẢN</th>
                      <th className="px-4 py-3 font-semibold border-b border-slate-200">SỐ VB</th>
                      <th className="px-4 py-3 font-semibold border-b border-slate-200">NGÀY VB</th>
                      <th className="px-4 py-3 font-semibold border-b border-slate-200">FILE VB</th>
                      <th className="px-4 py-3 font-semibold border-b border-slate-200">CƠ QUAN BAN HÀNH</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleRows.map((row, rowIndex) => {
                      // Skip empty rows or rows that are just section headers if they don't fit well
                      // But we'll try to render them nicely
                      const isSectionHeader = row[1] && !row[3] && !row[4] && !row[5] && !row[6];
                      const isCollapsed = isSectionHeader && collapsedSections.has(row[1]);
                      
                      return (
                        <tr 
                          key={rowIndex} 
                          className={`hover:bg-slate-50 transition-colors ${isSectionHeader ? 'bg-slate-100 font-semibold text-emerald-800 cursor-pointer' : ''}`}
                          onClick={() => isSectionHeader && toggleSection(row[1])}
                        >
                          <td className="px-4 py-3 border-r border-slate-100 text-center text-slate-500">
                            {isSectionHeader ? (
                              <div className="flex items-center justify-center">
                                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                              </div>
                            ) : row[0]}
                          </td>
                          <td className="px-4 py-3 border-r border-slate-100 whitespace-normal min-w-[300px] text-slate-700">{row[1]}</td>
                          <td className="px-4 py-3 border-r border-slate-100 text-center">{row[3]}</td>
                          <td className="px-4 py-3 border-r border-slate-100">{row[4]}</td>
                          <td className="px-4 py-3 border-r border-slate-100">
                            {row[5] && (row[5].startsWith('http://') || row[5].startsWith('https://')) ? (
                              <a 
                                href={row[5]} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded-md transition-all font-medium group"
                              >
                                <Eye className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                <span>Xem file</span>
                              </a>
                            ) : (
                              <span className={row[5]?.trim().toLowerCase() === 'xem file' ? 'text-slate-400 italic' : ''}>
                                {row[5]}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 border-r border-slate-100 text-center">{row[6]}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile View (Module/Card Layout) */}
              <div className="md:hidden divide-y divide-slate-100">
                {visibleRows.map((row, rowIndex) => {
                  const isSectionHeader = row[1] && !row[3] && !row[4] && !row[5] && !row[6];
                  const isCollapsed = isSectionHeader && collapsedSections.has(row[1]);
                  
                  if (isSectionHeader) {
                    return (
                      <div 
                        key={rowIndex} 
                        className="bg-slate-50 px-4 py-3 font-bold text-emerald-800 text-xs uppercase tracking-wider flex items-center justify-between cursor-pointer"
                        onClick={() => toggleSection(row[1])}
                      >
                        <span>{row[1]}</span>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                      </div>
                    );
                  }

                  const hasNoInfo = !row[3]?.trim() && !row[4]?.trim() && !(row[5] && (row[5].startsWith('http://') || row[5].startsWith('https://')));
                  
                  if (hasNoInfo) {
                    return (
                      <div key={rowIndex} className="p-4 bg-white">
                        <div className="flex items-start gap-3">
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                            {row[0]}
                          </span>
                          <div className="flex flex-col gap-1">
                            <h3 className="text-sm font-medium text-slate-700 leading-snug">
                              {row[1]}
                            </h3>
                            <span className="text-[11px] text-slate-400 italic">Chưa có văn bản</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={rowIndex} className="p-4 bg-white active:bg-slate-50 transition-colors">
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                          {row[0]}
                        </span>
                        <h3 className="text-sm font-medium text-slate-700 leading-snug">
                          {row[1]}
                        </h3>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4 ml-8">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] uppercase text-slate-400 font-bold tracking-widest">Số VB</span>
                          <span className="text-xs font-semibold text-slate-600">{row[3] || '---'}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] uppercase text-slate-400 font-bold tracking-widest">Ngày VB</span>
                          <span className="text-xs font-semibold text-slate-600">{row[4] || '---'}</span>
                        </div>
                      </div>

                      <div className="ml-8 flex items-end justify-between pt-3 border-t border-slate-50">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] uppercase text-slate-400 font-bold tracking-widest">Cơ quan ban hành</span>
                          <span className="text-xs text-slate-500 font-medium">{row[6] || '---'}</span>
                        </div>
                        <div>
                          {row[5] && (row[5].startsWith('http://') || row[5].startsWith('https://')) ? (
                            <a 
                              href={row[5]} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-[10px] font-bold shadow-sm active:scale-95 transition-all"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              XEM FILE
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic font-medium">
                              {row[5] || 'Không có file'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {rows.length === 0 && (
                  <div className="p-12 text-center text-slate-400 italic">
                    Không tìm thấy dữ liệu phù hợp
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Action Loading Overlay */}
      {actionLoading && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-8 max-w-sm w-full mx-4 flex flex-col items-center text-center">
            <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Đang xử lý dữ liệu...</h3>
            <p className="text-slate-500 text-sm">
              Hệ thống đang cập nhật...
            </p>
          </div>
        </div>
      )}
      <footer className="bg-blue-900 text-white/80 py-4 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs font-medium tracking-wide">
          <p>© 2026 Công ty Điện lực Vũng Tàu</p>
        </div>
      </footer>
    </div>
  );
}
