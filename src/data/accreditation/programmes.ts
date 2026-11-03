export interface ProgrammeSubjectNode {
  id: string;
  label: string;
  children?: ProgrammeSubjectNode[];
}

export interface AccreditationVisit {
  start: string;
  end: string;
  panel: string;
}

export interface AccreditationProgramme {
  slug: string;
  name: string;
  faculty: string;
  department: string;
  degreeLevels: string[];
  accreditationVisit: AccreditationVisit;
  searchTerms: string[];
  subjects: ProgrammeSubjectNode[];
  curriculumTopics: string[];
}

export const ACCREDITATION_YEAR_FROM = 2023;

export const ACCREDITATION_YEAR_TO = 2026;

export const accreditationProgrammes: AccreditationProgramme[] = [
  {
    slug: 'mechanical-production-engineering',
    name: 'Mechanical and Production Engineering',
    faculty: 'Faculty of Engineering and Technology',
    department: 'Mechanical & Production Engineering',
    degreeLevels: ['Undergraduate', "Master's"],
    accreditationVisit: { start: '2026-11-23', end: '2026-11-26', panel: 'Mechanical and Production Engineering' },
    searchTerms: [
      'mechanical engineering',
      'production engineering',
      'manufacturing engineering',
      'machine design',
      'thermodynamics',
    ],
    subjects: [
      {
        id: 'mechanical-production-engineering.design',
        label: 'Machine Design and Materials',
        children: [
          { id: 'mechanical-production-engineering.design.mechanics', label: 'Engineering mechanics' },
          { id: 'mechanical-production-engineering.design.materials', label: 'Materials science' },
          { id: 'mechanical-production-engineering.design.cadcam', label: 'CAD/CAM' },
        ],
      },
      {
        id: 'mechanical-production-engineering.manufacturing',
        label: 'Manufacturing and Production',
        children: [
          { id: 'mechanical-production-engineering.manufacturing.processes', label: 'Manufacturing processes' },
          { id: 'mechanical-production-engineering.manufacturing.robotics', label: 'Robotics and automation' },
          { id: 'mechanical-production-engineering.manufacturing.planning', label: 'Production planning and control' },
        ],
      },
      {
        id: 'mechanical-production-engineering.systems',
        label: 'Mechanical Systems and Thermodynamics',
        children: [
          { id: 'mechanical-production-engineering.systems.thermo', label: 'Thermodynamics' },
          { id: 'mechanical-production-engineering.systems.fluids', label: 'Fluid mechanics' },
          { id: 'mechanical-production-engineering.systems.heat', label: 'Heat transfer' },
        ],
      },
      {
        id: 'mechanical-production-engineering.industrial',
        label: 'Industrial Engineering',
        children: [
          { id: 'mechanical-production-engineering.industrial.operational-research', label: 'Operations research' },
          { id: 'mechanical-production-engineering.industrial.quality', label: 'Quality engineering' },
          { id: 'mechanical-production-engineering.industrial.ergonomics', label: 'Ergonomics' },
        ],
      },
    ],
    curriculumTopics: [
      'machine design',
      'manufacturing processes',
      'materials science',
      'production planning',
      'thermodynamics',
      'industrial engineering',
      'robotics',
      'CAD/CAM',
    ],
  },
  {
    slug: 'biomedical-engineering',
    name: 'Biomedical Engineering',
    faculty: 'Faculty of Engineering and Technology',
    department: 'Biomedical Engineering',
    degreeLevels: ['Undergraduate', "Master's"],
    accreditationVisit: { start: '2026-11-19', end: '2026-11-22', panel: 'Biomedical Engineering' },
    searchTerms: [
      'biomedical engineering',
      'medical devices',
      'biomechanics',
      'biomedical instrumentation',
      'medical imaging',
    ],
    subjects: [
      {
        id: 'biomedical-engineering.imaging',
        label: 'Medical Imaging',
        children: [
          { id: 'biomedical-engineering.imaging.physical-principles', label: 'Imaging physical principles' },
          { id: 'biomedical-engineering.imaging.modality-design', label: 'Imaging modality design' },
          { id: 'biomedical-engineering.imaging.image-processing', label: 'Medical image processing' },
        ],
      },
      {
        id: 'biomedical-engineering.biomaterials',
        label: 'Biomaterials and Tissue Engineering',
        children: [
          { id: 'biomedical-engineering.biomaterials.materials', label: 'Biomaterials' },
          { id: 'biomedical-engineering.biomaterials.tissue-engineering', label: 'Tissue engineering' },
          { id: 'biomedical-engineering.biomaterials.scaffolds', label: 'Scaffold and implant design' },
        ],
      },
      {
        id: 'biomedical-engineering.devices',
        label: 'Biomedical Devices and Instrumentation',
        children: [
          { id: 'biomedical-engineering.devices.sensors', label: 'Biosensors' },
          { id: 'biomedical-engineering.devices.instrumentation', label: 'Biomedical instrumentation' },
          { id: 'biomedical-engineering.devices.signal-processing', label: 'Biomedical signal processing' },
        ],
      },
      {
        id: 'biomedical-engineering.biosystems',
        label: 'Biosystems and Rehabilitation',
        children: [
          { id: 'biomedical-engineering.biosystems.biomechanics', label: 'Biomechanics' },
          { id: 'biomedical-engineering.biosystems.rehabilitation', label: 'Rehabilitation engineering' },
          { id: 'biomedical-engineering.biosystems.computational', label: 'Computational biology' },
        ],
      },
    ],
    curriculumTopics: [
      'biomedical engineering',
      'medical imaging',
      'biomechanics',
      'biomaterials',
      'biomedical instrumentation',
      'biosensors',
      'rehabilitation engineering',
      'medical devices',
    ],
  },
  {
    slug: 'chemical-engineering',
    name: 'Chemical Engineering',
    faculty: 'Faculty of Engineering and Technology',
    department: 'Chemical Engineering',
    degreeLevels: ['Undergraduate', "Master's"],
    accreditationVisit: { start: '2026-11-29', end: '2026-12-02', panel: 'Chemical Engineering' },
    searchTerms: [
      'chemical engineering',
      'chemical process design',
      'reaction engineering',
      'mass transfer',
      'process control',
    ],
    subjects: [
      {
        id: 'chemical-engineering.unit-operations',
        label: 'Unit Operations',
        children: [
          { id: 'chemical-engineering.unit-operations.mass-transfer', label: 'Mass transfer' },
          { id: 'chemical-engineering.unit-operations.heat-transfer', label: 'Heat transfer' },
          { id: 'chemical-engineering.unit-operations.fluid-flow', label: 'Fluid flow' },
        ],
      },
      {
        id: 'chemical-engineering.reactions',
        label: 'Chemical Reaction Engineering',
        children: [
          { id: 'chemical-engineering.reactions.kinetics', label: 'Reaction kinetics' },
          { id: 'chemical-engineering.reactions.reactor-design', label: 'Reactor design' },
          { id: 'chemical-engineering.reactions.analysis', label: 'Reaction networks' },
        ],
      },
      {
        id: 'chemical-engineering.process-design',
        label: 'Process Design and Separation',
        children: [
          { id: 'chemical-engineering.process-design.separation', label: 'Separation processes' },
          { id: 'chemical-engineering.process-design.thermodynamics', label: 'Chemical engineering thermodynamics' },
          { id: 'chemical-engineering.process-design.flowsheeting', label: 'Process flowsheeting' },
        ],
      },
      {
        id: 'chemical-engineering.automation',
        label: 'Process Control and Safety',
        children: [
          { id: 'chemical-engineering.automation.control', label: 'Process control' },
          { id: 'chemical-engineering.automation.safety', label: 'Industrial safety' },
          { id: 'chemical-engineering.automation.simulation', label: 'Process simulation' },
        ],
      },
    ],
    curriculumTopics: [
      'process design',
      'reaction engineering',
      'separation processes',
      'mass transfer',
      'heat transfer',
      'process control',
      'industrial safety',
      'chemical thermodynamics',
    ],
  },
  {
    slug: 'pharmacy',
    name: 'Pharmacy (B.Pharm)',
    faculty: 'Faculty of Pharmaceutical Sciences',
    department: 'Pharmacy',
    degreeLevels: ['Undergraduate'],
    accreditationVisit: { start: '2026-11-01', end: '2026-11-04', panel: 'Pharmacy' },
    searchTerms: [
      'pharmacology',
      'pharmaceutics',
      'medicinal chemistry',
      'pharmacognosy',
      'pharmaceutical microbiology',
    ],
    subjects: [
      {
        id: 'pharmacy.pharmacology',
        label: 'Pharmacology and Toxicology',
        children: [
          { id: 'pharmacy.pharmacology.pharmacokinetics', label: 'Pharmacokinetics' },
          { id: 'pharmacy.pharmacology.pharmacodynamics', label: 'Pharmacodynamics' },
          { id: 'pharmacy.pharmacology.toxicology', label: 'Toxicology' },
        ],
      },
      {
        id: 'pharmacy.pharmaceutics',
        label: 'Pharmaceutics and Pharmaceutical Technology',
        children: [
          { id: 'pharmacy.pharmaceutics.formulation', label: 'Pharmaceutical formulation' },
          { id: 'pharmacy.pharmaceutics.biopharmaceutics', label: 'Biopharmaceutics' },
          { id: 'pharmacy.pharmaceutics.quality', label: 'Pharmaceutical quality control' },
        ],
      },
      {
        id: 'pharmacy.medicinal-chemistry',
        label: 'Pharmaceutical and Medicinal Chemistry',
        children: [
          { id: 'pharmacy.medicinal-chemistry.medical-synthesis', label: 'Medicinal chemistry' },
          { id: 'pharmacy.medicinal-chemistry.pharmacognosy', label: 'Pharmacognosy' },
          { id: 'pharmacy.medicinal-chemistry.analysis', label: 'Pharmaceutical analysis' },
        ],
      },
      {
        id: 'pharmacy.microbiology',
        label: 'Pharmaceutical Microbiology',
        children: [
          { id: 'pharmacy.microbiology.contamination', label: 'Microbial contamination control' },
          { id: 'pharmacy.microbiology.antimicrobials', label: 'Antimicrobial agents' },
          { id: 'pharmacy.microbiology.hygiene', label: 'Industrial microbiology' },
        ],
      },
    ],
    curriculumTopics: [
      'pharmacology',
      'pharmaceutics',
      'medicinal chemistry',
      'pharmacognosy',
      'pharmacokinetics',
      'pharmaceutical microbiology',
      'toxicology',
      'pharmaceutical formulation',
    ],
  },
  {
    slug: 'accounting',
    name: 'Accounting',
    faculty: 'Faculty of Administration and Management Sciences',
    department: 'Accounting',
    degreeLevels: ['Undergraduate', "Master's"],
    accreditationVisit: { start: '2026-11-12', end: '2026-11-15', panel: 'M.Sc. Accounting' },
    searchTerms: [
      'accounting',
      'financial accounting',
      'auditing',
      'public sector accounting',
      'management accounting',
    ],
    subjects: [
      {
        id: 'accounting.financial-accounting',
        label: 'Financial Accounting',
        children: [
          { id: 'accounting.financial-accounting.reporting', label: 'Financial reporting standards' },
          { id: 'accounting.financial-accounting.consolidation', label: 'Group consolidation' },
          { id: 'accounting.financial-accounting.analysis', label: 'Financial statement analysis' },
        ],
      },
      {
        id: 'accounting.auditing',
        label: 'Auditing and Assurance',
        children: [
          { id: 'accounting.auditing.internal', label: 'Internal audit' },
          { id: 'accounting.auditing.forensic', label: 'Forensic accounting' },
          { id: 'accounting.auditing.assurance', label: 'Assurance services' },
        ],
      },
      {
        id: 'accounting.management-accounting',
        label: 'Management Accounting',
        children: [
          { id: 'accounting.management-accounting.costing', label: 'Cost accounting' },
          { id: 'accounting.management-accounting.budgeting', label: 'Budgeting and control' },
          { id: 'accounting.management-accounting.decision', label: 'Decision making' },
        ],
      },
      {
        id: 'accounting.taxation',
        label: 'Taxation',
        children: [
          { id: 'accounting.taxation.personal', label: 'Personal income tax' },
          { id: 'accounting.taxation.corporate', label: 'Corporate taxation' },
        ],
      },
      {
        id: 'accounting.public-sector',
        label: 'Public Sector Accounting',
        children: [
          { id: 'accounting.public-sector.government', label: 'Government accounting' },
          { id: 'accounting.public-sector.fiscal', label: 'Fiscal policy' },
        ],
      },
      {
        id: 'accounting.governance',
        label: 'Governance and Ethics',
        children: [
          { id: 'accounting.governance.corporate-governance', label: 'Corporate governance' },
          { id: 'accounting.governance.ethics', label: 'Professional ethics' },
        ],
      },
    ],
    curriculumTopics: [
      'financial accounting',
      'auditing',
      'cost accounting',
      'taxation',
      'financial reporting',
      'forensic accounting',
      'corporate governance',
      'public sector accounting',
    ],
  },
  {
    slug: 'banking-finance',
    name: 'Banking and Finance',
    faculty: 'Faculty of Administration and Management Sciences',
    department: 'Banking and Finance',
    degreeLevels: ['Undergraduate', "Master's"],
    accreditationVisit: { start: '2026-11-12', end: '2026-11-15', panel: 'M.Sc. Banking and Finance' },
    searchTerms: [
      'banking',
      'financial management',
      'corporate finance',
      'financial markets',
      'microfinance',
    ],
    subjects: [
      {
        id: 'banking-finance.bank-management',
        label: 'Bank Management',
        children: [
          { id: 'banking-finance.bank-management.risk', label: 'Bank risk management' },
          { id: 'banking-finance.bank-management.lending', label: 'Credit and lending' },
          { id: 'banking-finance.bank-management.digital', label: 'Digital banking' },
        ],
      },
      {
        id: 'banking-finance.financial-markets',
        label: 'Financial Markets',
        children: [
          { id: 'banking-finance.financial-markets.capital', label: 'Capital markets' },
          { id: 'banking-finance.financial-markets.instruments', label: 'Financial instruments' },
          { id: 'banking-finance.financial-markets.derivatives', label: 'Derivatives' },
        ],
      },
      {
        id: 'banking-finance.corporate-finance',
        label: 'Corporate Finance',
        children: [
          { id: 'banking-finance.corporate-finance.investment', label: 'Investment appraisal' },
          { id: 'banking-finance.corporate-finance.valuation', label: 'Company valuation' },
          { id: 'banking-finance.corporate-finance.portfolio', label: 'Portfolio management' },
        ],
      },
      {
        id: 'banking-finance.monetary-economics',
        label: 'Monetary Economics',
        children: [
          { id: 'banking-finance.monetary-economics.central-banking', label: 'Central banking' },
          { id: 'banking-finance.monetary-economics.monetary-policy', label: 'Monetary policy' },
        ],
      },
      {
        id: 'banking-finance.insurance',
        label: 'Insurance and Risk',
        children: [
          { id: 'banking-finance.insurance.principles', label: 'Principles of insurance' },
          { id: 'banking-finance.insurance.enterprise', label: 'Enterprise risk' },
        ],
      },
      {
        id: 'banking-finance.inclusive-finance',
        label: 'Inclusive Finance',
        children: [
          { id: 'banking-finance.inclusive-finance.microfinance', label: 'Microfinance' },
          { id: 'banking-finance.inclusive-finance.fintech', label: 'Fintech and mobile money' },
        ],
      },
    ],
    curriculumTopics: [
      'banking',
      'corporate finance',
      'financial markets',
      'monetary policy',
      'risk management',
      'microfinance',
      'investment',
      'insurance',
    ],
  },
  {
    slug: 'marketing',
    name: 'Marketing',
    faculty: 'Faculty of Administration and Management Sciences',
    department: 'Marketing',
    degreeLevels: ['Undergraduate', "Master's"],
    accreditationVisit: { start: '2026-11-12', end: '2026-11-15', panel: 'M.Sc. Marketing' },
    searchTerms: [
      'marketing',
      'consumer behaviour',
      'digital marketing',
      'marketing management',
      'advertising',
    ],
    subjects: [
      {
        id: 'marketing.consumer-behaviour',
        label: 'Consumer Behaviour',
        children: [
          { id: 'marketing.consumer-behaviour.buyer-psychology', label: 'Buyer psychology' },
          { id: 'marketing.consumer-behaviour.segmentation', label: 'Segmentation and targeting' },
        ],
      },
      {
        id: 'marketing.digital-marketing',
        label: 'Digital Marketing',
        children: [
          { id: 'marketing.digital-marketing.social-media', label: 'Social media marketing' },
          { id: 'marketing.digital-marketing.analytics', label: 'Marketing analytics' },
          { id: 'marketing.digital-marketing.ecommerce', label: 'E-commerce marketing' },
        ],
      },
      {
        id: 'marketing.brand-management',
        label: 'Brand Management',
        children: [
          { id: 'marketing.brand-management.positioning', label: 'Brand positioning' },
          { id: 'marketing.brand-management.equity', label: 'Brand equity' },
        ],
      },
      {
        id: 'marketing.research',
        label: 'Marketing Research',
        children: [
          { id: 'marketing.research.methods', label: 'Research methods' },
          { id: 'marketing.research.forecasting', label: 'Sales forecasting' },
        ],
      },
      {
        id: 'marketing.strategy',
        label: 'Marketing Strategy',
        children: [
          { id: 'marketing.strategy.product-policy', label: 'Product policy' },
          { id: 'marketing.strategy.pricing', label: 'Pricing strategy' },
          { id: 'marketing.strategy.distribution', label: 'Distribution channels' },
        ],
      },
      {
        id: 'marketing.integrated',
        label: 'Integrated Marketing Communications',
        children: [
          { id: 'marketing.integrated.advertising', label: 'Advertising' },
          { id: 'marketing.integrated.promotion', label: 'Sales promotion' },
        ],
      },
    ],
    curriculumTopics: [
      'consumer behaviour',
      'digital marketing',
      'brand management',
      'marketing research',
      'advertising',
      'pricing strategy',
      'sales management',
      'e-commerce',
    ],
  },
  {
    slug: 'anatomy',
    name: 'Anatomy',
    faculty: 'Faculty of Basic Medical Sciences',
    department: 'Anatomy',
    degreeLevels: ['Undergraduate', "Master's"],
    accreditationVisit: { start: '2026-11-15', end: '2026-11-18', panel: 'Anatomy' },
    searchTerms: [
      'anatomy',
      'human anatomy',
      'histology',
      'embryology',
      'gross anatomy',
    ],
    subjects: [
      {
        id: 'anatomy.gross-anatomy',
        label: 'Gross Anatomy',
        children: [
          { id: 'anatomy.gross-anatomy.locomotor', label: 'Locomotor system' },
          { id: 'anatomy.gross-anatomy.viscera', label: 'Visceral anatomy' },
          { id: 'anatomy.gross-anatomy.neuroanatomy', label: 'Neuroanatomy' },
        ],
      },
      {
        id: 'anatomy.histology',
        label: 'Histology and Microanatomy',
        children: [
          { id: 'anatomy.histology.tissues', label: 'Tissue biology' },
          { id: 'anatomy.histology.microscopy', label: 'Microscopy techniques' },
        ],
      },
      {
        id: 'anatomy.embryology',
        label: 'Embryology',
        children: [
          { id: 'anatomy.embryology.development', label: 'Human development' },
          { id: 'anatomy.embryology.congenital', label: 'Congenital variation' },
        ],
      },
      {
        id: 'anatomy.anthropology',
        label: 'Biological Anthropology',
        children: [
          { id: 'anatomy.anthropology.growth', label: 'Growth and development' },
          { id: 'anatomy.anthropology.variation', label: 'Human variation' },
        ],
      },
      {
        id: 'anatomy.imaging',
        label: 'Clinical and Imaging Anatomy',
        children: [
          { id: 'anatomy.imaging.radiological', label: 'Radiological anatomy' },
          { id: 'anatomy.imaging.applied', label: 'Applied anatomy' },
        ],
      },
    ],
    curriculumTopics: [
      'gross anatomy',
      'histology',
      'embryology',
      'neuroanatomy',
      'anthropology',
      'radiological anatomy',
      'microanatomy',
      'human development',
    ],
  },
  {
    slug: 'computer-science',
    name: 'Computer Science',
    faculty: 'Faculty of Engineering and Technology',
    department: 'Computer Science',
    degreeLevels: ['Undergraduate', "Master's"],
    accreditationVisit: { start: '2026-11-15', end: '2026-11-18', panel: 'Computer Science' },
    searchTerms: [
      'computer science',
      'software engineering',
      'artificial intelligence',
      'data structures',
      'computer networks',
    ],
    subjects: [
      {
        id: 'computer-science.programming',
        label: 'Programming and Software Engineering',
        children: [
          { id: 'computer-science.programming.data-structures', label: 'Data structures' },
          { id: 'computer-science.programming.algorithms', label: 'Algorithms' },
          { id: 'computer-science.programming.software-engineering', label: 'Software engineering' },
        ],
      },
      {
        id: 'computer-science.systems',
        label: 'Computer Systems and Networks',
        children: [
          { id: 'computer-science.systems.networks', label: 'Computer networks' },
          { id: 'computer-science.systems.operating-systems', label: 'Operating systems' },
          { id: 'computer-science.systems.embedded', label: 'Embedded systems' },
        ],
      },
      {
        id: 'computer-science.data',
        label: 'Data and Databases',
        children: [
          { id: 'computer-science.data.database-systems', label: 'Database systems' },
          { id: 'computer-science.data.big-data', label: 'Big data analytics' },
        ],
      },
      {
        id: 'computer-science.intelligence',
        label: 'Artificial Intelligence',
        children: [
          { id: 'computer-science.intelligence.machine-learning', label: 'Machine learning' },
          { id: 'computer-science.intelligence.computer-vision', label: 'Computer vision' },
          { id: 'computer-science.intelligence.nlp', label: 'Natural language processing' },
        ],
      },
      {
        id: 'computer-science.security',
        label: 'Cyber Security',
        children: [
          { id: 'computer-science.security.network-security', label: 'Network security' },
          { id: 'computer-science.security.cryptography', label: 'Cryptography' },
        ],
      },
      {
        id: 'computer-science.web',
        label: 'Web and Mobile Development',
        children: [
          { id: 'computer-science.web.front-end', label: 'Web technologies' },
          { id: 'computer-science.web.mobile', label: 'Mobile application development' },
        ],
      },
    ],
    curriculumTopics: [
      'algorithms',
      'data structures',
      'databases',
      'software engineering',
      'computer networks',
      'artificial intelligence',
      'cybersecurity',
      'web development',
    ],
  },
  {
    slug: 'education-mathematics',
    name: 'Education Mathematics',
    faculty: 'Faculty of Education',
    department: 'Science Education',
    degreeLevels: ['Undergraduate'],
    accreditationVisit: { start: '2026-11-22', end: '2026-11-25', panel: 'Education Mathematics' },
    searchTerms: [
      'mathematics education',
      'mathematics pedagogy',
      'teaching of mathematics',
      'STEM education Nigeria',
    ],
    subjects: [
      {
        id: 'education-mathematics.pure-mathematics',
        label: 'Pure Mathematics',
        children: [
          { id: 'education-mathematics.pure-mathematics.algebra', label: 'Algebra' },
          { id: 'education-mathematics.pure-mathematics.geometry', label: 'Geometry' },
          { id: 'education-mathematics.pure-mathematics.calculus', label: 'Calculus' },
        ],
      },
      {
        id: 'education-mathematics.applied-mathematics',
        label: 'Applied Mathematics',
        children: [
          { id: 'education-mathematics.applied-mathematics.statistics', label: 'Statistics' },
          { id: 'education-mathematics.applied-mathematics.numerical', label: 'Numerical analysis' },
        ],
      },
      {
        id: 'education-mathematics.pedagogy',
        label: 'Mathematics Pedagogy',
        children: [
          { id: 'education-mathematics.pedagogy.curriculum', label: 'Mathematics curriculum' },
          { id: 'education-mathematics.pedagogy.instruction', label: 'Instructional strategies' },
          { id: 'education-mathematics.pedagogy.assessment', label: 'Assessment in mathematics' },
        ],
      },
      {
        id: 'education-mathematics.educational-technology',
        label: 'Technology in Mathematics Education',
        children: [
          { id: 'education-mathematics.educational-technology.digital-tools', label: 'Digital learning tools' },
          { id: 'education-mathematics.educational-technology.visualization', label: 'Mathematical visualization' },
        ],
      },
    ],
    curriculumTopics: [
      'algebra',
      'geometry',
      'calculus',
      'statistics',
      'mathematics education',
      'mathematics pedagogy',
      'numerical analysis',
      'mathematics curriculum',
    ],
  },
  {
    slug: 'civil-engineering',
    name: 'Civil Engineering',
    faculty: 'Faculty of Engineering and Technology',
    department: 'Civil Engineering',
    degreeLevels: ['Undergraduate', "Master's"],
    accreditationVisit: { start: '2026-11-23', end: '2026-11-26', panel: 'Civil Engineering' },
    searchTerms: [
      'civil engineering',
      'structural engineering',
      'transportation engineering',
      'geotechnical engineering',
      'construction management',
    ],
    subjects: [
      {
        id: 'civil-engineering.structural',
        label: 'Structural Engineering',
        children: [
          { id: 'civil-engineering.structural.concrete', label: 'Concrete technology' },
          { id: 'civil-engineering.structural.steel', label: 'Steel structures' },
          { id: 'civil-engineering.structural.analysis', label: 'Structural analysis' },
        ],
      },
      {
        id: 'civil-engineering.transportation',
        label: 'Transportation Engineering',
        children: [
          { id: 'civil-engineering.transportation.highway', label: 'Highway design' },
          { id: 'civil-engineering.transportation.traffic', label: 'Traffic engineering' },
        ],
      },
      {
        id: 'civil-engineering.geotechnical',
        label: 'Geotechnical Engineering',
        children: [
          { id: 'civil-engineering.geotechnical.soil-mechanics', label: 'Soil mechanics' },
          { id: 'civil-engineering.geotechnical.foundations', label: 'Foundation engineering' },
        ],
      },
      {
        id: 'civil-engineering.water',
        label: 'Water Resources and Environmental Engineering',
        children: [
          { id: 'civil-engineering.water.hydraulics', label: 'Fluid mechanics and hydraulics' },
          { id: 'civil-engineering.water.wastewater', label: 'Water supply and wastewater' },
        ],
      },
      {
        id: 'civil-engineering.construction',
        label: 'Construction Management',
        children: [
          { id: 'civil-engineering.construction.project-management', label: 'Project management' },
          { id: 'civil-engineering.construction.surveying', label: 'Surveying' },
        ],
      },
    ],
    curriculumTopics: [
      'structural engineering',
      'transportation engineering',
      'geotechnical engineering',
      'construction management',
      'environmental engineering',
      'fluid mechanics',
      'surveying',
      'concrete technology',
    ],
  },
  {
    slug: 'education-biology',
    name: 'Education Biology',
    faculty: 'Faculty of Education',
    department: 'Science Education',
    degreeLevels: ['Undergraduate'],
    accreditationVisit: { start: '2026-11-26', end: '2026-11-29', panel: 'Education Biology' },
    searchTerms: [
      'biology education',
      'science education',
      'biology teaching',
      'biology curriculum',
    ],
    subjects: [
      {
        id: 'education-biology.organismal',
        label: 'Organismal Biology',
        children: [
          { id: 'education-biology.organismal.zoology', label: 'Zoology' },
          { id: 'education-biology.organismal.botany', label: 'Botany' },
          { id: 'education-biology.organismal.ecology', label: 'Ecology' },
        ],
      },
      {
        id: 'education-biology.cell-molecular',
        label: 'Cell and Molecular Biology',
        children: [
          { id: 'education-biology.cell-molecular.genetics', label: 'Genetics' },
          { id: 'education-biology.cell-molecular.microbiology', label: 'Microbiology' },
        ],
      },
      {
        id: 'education-biology.pedagogy',
        label: 'Biology Pedagogy',
        children: [
          { id: 'education-biology.pedagogy.curriculum', label: 'Biology curriculum' },
          { id: 'education-biology.pedagogy.laboratory', label: 'Laboratory teaching' },
          { id: 'education-biology.pedagogy.instruction', label: 'Instructional methods' },
        ],
      },
      {
        id: 'education-biology.human-biology',
        label: 'Human Biology and Health',
        children: [
          { id: 'education-biology.human-biology.physiology', label: 'Physiology' },
          { id: 'education-biology.human-biology.health-education', label: 'Health education' },
        ],
      },
    ],
    curriculumTopics: [
      'genetics',
      'ecology',
      'microbiology',
      'botany',
      'zoology',
      'biology education',
      'biology curriculum',
      'laboratory teaching',
    ],
  },
  {
    slug: 'integrated-science',
    name: 'Integrated Science',
    faculty: 'Faculty of Education',
    department: 'Science Education',
    degreeLevels: ['Undergraduate'],
    accreditationVisit: { start: '2026-11-26', end: '2026-11-29', panel: 'Integrated Science' },
    searchTerms: [
      'integrated science',
      'integrated science education',
      'STEM education',
      'science pedagogy',
    ],
    subjects: [
      {
        id: 'integrated-science.physical-sciences',
        label: 'Physical Sciences',
        children: [
          { id: 'integrated-science.physical-sciences.physics', label: 'Physics foundations' },
          { id: 'integrated-science.physical-sciences.chemistry', label: 'Chemistry foundations' },
        ],
      },
      {
        id: 'integrated-science.life-sciences',
        label: 'Life Sciences',
        children: [
          { id: 'integrated-science.life-sciences.biology', label: 'Biology foundations' },
          { id: 'integrated-science.life-sciences.earth', label: 'Earth science' },
        ],
      },
      {
        id: 'integrated-science.pedagogy',
        label: 'Integrated Science Pedagogy',
        children: [
          { id: 'integrated-science.pedagogy.curriculum', label: 'Integrated science curriculum' },
          { id: 'integrated-science.pedagogy.instruction', label: 'Teaching methods' },
          { id: 'integrated-science.pedagogy.assessment', label: 'Assessment' },
        ],
      },
      {
        id: 'integrated-science.stem',
        label: 'STEM Education',
        children: [
          { id: 'integrated-science.stem.project-based', label: 'Project-based learning' },
          { id: 'integrated-science.stem.inquiry', label: 'Inquiry-based science' },
        ],
      },
    ],
    curriculumTopics: [
      'integrated science',
      'science education',
      'science curriculum',
      'STEM education',
      'inquiry-based learning',
      'earth science',
      'science teaching',
      'laboratory practice',
    ],
  },
  {
    slug: 'environmental-management-and-toxicology',
    name: 'Environmental Management and Toxicology',
    faculty: 'Faculty of Environmental Sciences',
    department: 'Environmental Management and Toxicology',
    degreeLevels: ['Undergraduate'],
    accreditationVisit: { start: '2026-12-02', end: '2026-12-05', panel: 'Environmental Management and Toxicology' },
    searchTerms: [
      'environmental management',
      'environmental toxicology',
      'pollution control',
      'environmental impact assessment',
      'waste management',
    ],
    subjects: [
      {
        id: 'environmental-management-and-toxicology.pollution',
        label: 'Pollution Control',
        children: [
          { id: 'environmental-management-and-toxicology.pollution.air', label: 'Air quality management' },
          { id: 'environmental-management-and-toxicology.pollution.water', label: 'Water pollution control' },
          { id: 'environmental-management-and-toxicology.pollution.soil', label: 'Soil remediation' },
        ],
      },
      {
        id: 'environmental-management-and-toxicology.impact',
        label: 'Environmental Impact Assessment',
        children: [
          { id: 'environmental-management-and-toxicology.impact.eia', label: 'EIA methods' },
          { id: 'environmental-management-and-toxicology.impact.regulation', label: 'Environmental regulation' },
        ],
      },
      {
        id: 'environmental-management-and-toxicology.waste',
        label: 'Waste Management',
        children: [
          { id: 'environmental-management-and-toxicology.waste.hazardous', label: 'Hazardous waste' },
          { id: 'environmental-management-and-toxicology.waste.circular', label: 'Circular economy' },
        ],
      },
      {
        id: 'environmental-management-and-toxicology.toxicology',
        label: 'Environmental Toxicology',
        children: [
          { id: 'environmental-management-and-toxicology.toxicology.ecotoxicology', label: 'Ecotoxicology' },
          { id: 'environmental-management-and-toxicology.toxicology.exposure', label: 'Risk assessment' },
        ],
      },
      {
        id: 'environmental-management-and-toxicology.climate',
        label: 'Climate and Sustainability',
        children: [
          { id: 'environmental-management-and-toxicology.climate.change', label: 'Climate change' },
          { id: 'environmental-management-and-toxicology.climate.sustainability', label: 'Sustainable development' },
        ],
      },
    ],
    curriculumTopics: [
      'pollution control',
      'environmental impact assessment',
      'waste management',
      'climate change',
      'sustainability',
      'toxicology',
      'environmental monitoring',
      'ecotoxicology',
    ],
  },
  {
    slug: 'doctor-of-pharmacy',
    name: 'Doctor of Pharmacy',
    faculty: 'Faculty of Pharmaceutical Sciences',
    department: 'Pharmacy',
    degreeLevels: ['Doctor of Pharmacy (PharmD)'],
    accreditationVisit: { start: '2026-12-06', end: '2026-12-09', panel: 'Doctor of Pharmacy (PharmD)' },
    searchTerms: [
      'doctor of pharmacy',
      'clinical pharmacy',
      'pharmaceutical care',
      'patient care pharmacy',
      'pharmacy education',
    ],
    subjects: [
      {
        id: 'doctor-of-pharmacy.clinical-care',
        label: 'Clinical Pharmacy and Patient Care',
        children: [
          { id: 'doctor-of-pharmacy.clinical-care.therapeutics', label: 'Disease-state therapeutics' },
          { id: 'doctor-of-pharmacy.clinical-care.pharmacotherapy', label: 'Pharmacotherapy' },
          { id: 'doctor-of-pharmacy.clinical-care.counseling', label: 'Patient counselling' },
        ],
      },
      {
        id: 'doctor-of-pharmacy.pharmaceutical-sciences',
        label: 'Pharmaceutical Sciences',
        children: [
          { id: 'doctor-of-pharmacy.pharmaceutical-sciences.pharmacology', label: 'Pharmacology' },
          { id: 'doctor-of-pharmacy.pharmaceutical-sciences.pharmaceutics', label: 'Pharmaceutics' },
          { id: 'doctor-of-pharmacy.pharmaceutical-sciences.chemistry', label: 'Pharmaceutical chemistry' },
        ],
      },
      {
        id: 'doctor-of-pharmacy.public-health',
        label: 'Public Health Pharmacy',
        children: [
          { id: 'doctor-of-pharmacy.public-health.epidemiology', label: 'Epidemiology' },
          { id: 'doctor-of-pharmacy.public-health.community', label: 'Community pharmacy' },
        ],
      },
      {
        id: 'doctor-of-pharmacy.professionalism',
        label: 'Pharmacy Practice and Professionalism',
        children: [
          { id: 'doctor-of-pharmacy.professionalism.ethics', label: 'Pharmacy ethics' },
          { id: 'doctor-of-pharmacy.professionalism.management', label: 'Pharmacy systems management' },
        ],
      },
      {
        id: 'doctor-of-pharmacy.clerkship',
        label: 'Clinical Clerkship',
        children: [
          { id: 'doctor-of-pharmacy.clerkship.hospital', label: 'Hospital rotations' },
          { id: 'doctor-of-pharmacy.clerkship.community', label: 'Community rotations' },
        ],
      },
    ],
    curriculumTopics: [
      'pharmacotherapy',
      'clinical pharmacy',
      'pharmaceutical care',
      'patient counselling',
      'pharmacy practice',
      'epidemiology',
      'pharmacy ethics',
      'community pharmacy',
    ],
  },
];

export const programmeBySlug = (slug: string): AccreditationProgramme | undefined =>
  accreditationProgrammes.find((programme) => programme.slug === slug);

export const programmeSubjectLabels = (programme: AccreditationProgramme): string[] => {
  const labels: string[] = [];
  const walk = (nodes: ProgrammeSubjectNode[]): void => {
    for (const node of nodes) {
      labels.push(node.label);
      if (node.children) walk(node.children);
    }
  };
  walk(programme.subjects);
  return labels;
};
