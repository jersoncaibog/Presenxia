'use client'
import { Filter, SearchBar, StudentCard, StudentForm } from "@/components";
import supabase from '@/lib/supabaseClient';
import { StudentProps } from '@/types';
import { lineSpinner } from 'ldrs';
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { IoSearch } from "react-icons/io5";
import { RiFilter2Line } from "react-icons/ri";
import InfiniteScroll from 'react-infinite-scroll-component';
import styles from './styles.module.css';

const Page = () => {

  lineSpinner.register()

  const router = useRouter()
  const [students, setStudents] = useState<StudentProps[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const numPerPage = 20;
  const searchParams = useSearchParams();

  const fetchStudentsDataWithFilters = async (isNewPage = false) => {
    const queryParams = {
      courses: searchParams.get("courses")?.split(","),
      years: searchParams.get("years")?.split(",").map((i) => parseInt(i)),
      sections: searchParams.get("sections")?.split(","),
      order: searchParams.get("order"),
      sortBy: searchParams.get("sortBy")
    };

    if (
      queryParams.courses &&
      queryParams.years &&
      queryParams.sections &&
      queryParams.sortBy
    ) {
      const { data, error } = !isNewPage
      ? await supabase
        .from("student")
        .select("*")
        .in("course", queryParams.courses)
        .in("year", queryParams.years)
        .in("section", queryParams.sections)
        .order(queryParams.sortBy, {
          ascending: queryParams.order === "ascending",
        })
        .range(0, numPerPage - 1)
      : await supabase
        .from("student")
        .select("*")
        .in("course", queryParams.courses)
        .in("year", queryParams.years)
        .in("section", queryParams.sections)
        .order(queryParams.sortBy, {
          ascending: queryParams.order === "ascending",
        })
        .range(page * numPerPage, (page + 1) * numPerPage - 1)

      if (!isNewPage) {
        setPage(0)
      }

      if (error) {
        console.error(error)
      } else {
        isNewPage 
        ? setStudents((prev) => (prev[0]?.id !== data[0]?.id) ? [...prev, ...data] : prev)
        : setStudents(data)
        
        setHasMore(data.length === numPerPage);
        data.length === 0
        ? setIsStudentsEmpty(true)
        : setIsStudentsEmpty(false)
      }
    }
  }

  const fetchStudents = async (isNewPage = false) => {
    const { data, error } = await supabase
      .from("student")
      .select("*")
      .order("name", { ascending: true })
      .range(page * numPerPage, (page + 1) * numPerPage - 1);

    if (error) {
      console.error(error);
    } else {
      isNewPage 
      ? setStudents((prev) => (prev[0]?.id !== data[0]?.id) ? [...prev, ...data] : prev)
      : setStudents(data)

      setHasMore(data.length === numPerPage);
      data.length === 0
      ? setIsStudentsEmpty(true)
      : setIsStudentsEmpty(false)
    }        
  };

  const getStudents = (isNewPage = false) => {

    if (searchParams.get("order")) {
      fetchStudentsDataWithFilters(isNewPage)
    } else {
      fetchStudents(isNewPage);
    }
  
    setLoading(false);
  }

  useEffect(() => {
    getStudents(false)
  }, [searchParams]);

  useEffect(() => {
    getStudents(true)
  }, [page])

  useEffect(() => {
    const channel = supabase
      .channel('realtime_students_A')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'student'
      }, (payload) => {
        // console.log('new student: ')
        // console.log(payload.new)
        setStudents((prevStudents) => [...prevStudents, payload.new as StudentProps])
        getStudents()
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'student'
      }, (payload) => {
        // console.log('updated student: ')
        // console.log(payload.new)
        setStudents((prevStudents) => [...prevStudents, payload.new as StudentProps])
        getStudents()
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'student'
      }, (payload) => {
        // console.log('deleted student id: ' + payload.old)
        getStudents()
      })
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<StudentProps[] | any>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isStudentsEmpty, setIsStudentsEmpty] = useState(false);

  // search
  useEffect(() => {
    const fetchSearchQuery = async () => {
      const column = !isNaN(Number(searchQuery.charAt(0)))
      ? "id" // if query is an ID
      : "name" // if query is a string

      const {data, error} = await supabase
        .from("student")
        .select()
        .textSearch(column, searchQuery, {
          type: "websearch",
          config: "english"
        })

      if (error) {
        console.error(error)
      } else {
        // if search query does not exactly match any row
        if (data.length === 0 && searchQuery !== "") {
          const {data: data2, error: error2} = await supabase
            .from("student")
            .select()
            .ilike(column, `%${searchQuery}%`)
          
          if (error2) {
            console.error(error2)
          } else {
    
            setSearchResults(data2);
            data2.length === 0
            ? setIsStudentsEmpty(true)
            : setIsStudentsEmpty(false)
          }
        // if search query exactly matches a row
        } else {
          setSearchResults(data);
          data.length === 0
          ? setIsStudentsEmpty(true)
          : setIsStudentsEmpty(false)
        }
      }
    }
    
    if (isSearchOpen) fetchSearchQuery()
  }, [searchQuery])

  useEffect(() => {
    if (searchResults) setStudents([ ...searchResults ])
  }, [searchResults])

  useEffect(() => {
    console.log("___________________")
    console.log(`page: ${page + 1}`)
    console.log(`students: ${students.length}`)
    console.log(`filters: ${searchParams.get('order') !== null}`)
  }, [page, students, searchParams])

  // filters
  const [isOpen, setIsOpen] = useState<boolean | undefined>(false);
  const [courses, setCourses] = useState<string[] | undefined>(["AllCourses"]);
  const [years, setYears] = useState<string[] | undefined>(["AllYears"]);
  const [sections, setSections] = useState<string[] | undefined>(["AllSections"]);
  const [sortBy, setSortBy] = useState<string | undefined>("name");
  const [order, setOrder] = useState<string | undefined>("ascending");
  const allYears = [1, 2, 3, 4];
  const allSections = ["A", "B", "C", "D", "E"];
  const allCourses = [ "BSCE", "BSIT", "BOT", "BSHM", "BSTM", "BSE", "BSBA", "BSAIS", "BAC", "BTVTED", "BSED", "BEED", "BSN", "BSCRIM", "BSINFOTECH" ];

  async function applyFilters() {
    setLoading(true);

    const studentIDList: Array<string> | undefined = students?.map((student) => student.id);
    const filterCourses = courses?.includes("AllCourses") ? allCourses : courses;
    const filterYears = years?.includes("AllYears")
      ? allYears
      : years?.map((year) => parseInt(year));
    const filterSections = sections?.includes("AllSections")
      ? allSections
      : sections;
    const filterOrder = order;
    const filterSortBy = sortBy;

    // URL search params
    const queryParams = new URLSearchParams();

    // modify search params
    if (filterCourses) queryParams.set("courses", filterCourses.toString());
    if (filterYears) queryParams.set("years", filterYears.toString());
    if (filterSections) queryParams.set("sections", filterSections.toString());
    if (filterOrder) queryParams.set("order", filterOrder.toString());
    if (filterSortBy) queryParams.set("sortBy", filterSortBy);

    // push to the new URL with new params
    router.push(`?${queryParams.toString()}`);

    setIsOpen(false);
    setLoading(false);
  }

  // pretty print all filters data
  useEffect(() => {
    const filters = {
      courses,
      years,
      sections,
      sortBy,
      order,
    };
    // console.log(JSON.stringify(filters, null, 2));
  }, [courses, years, sections, sortBy, order]);

  useEffect(() => {
    let paramsCourses = searchParams.get("courses")?.split(",")
    let paramsYears = searchParams.get("years")?.split(",")
    let paramsSections = searchParams.get("sections")?.split(",")
    let paramsSortBy = searchParams.get("sortBy")
    let paramsOrder = searchParams.get("order")

    setCourses(paramsCourses?.length === 15 ? ["AllCourses"] : paramsCourses )
    setYears(paramsYears?.length === 15 ? ["AllYears"] : paramsYears )
    setSections(paramsSections?.length === 15 ? ["AllSections"] : paramsSections )
    setSortBy(paramsSortBy || "name")
    setOrder(paramsOrder || "ascending")

  }, [searchParams])

  return (
    <div className='bg-white h-[100vh] pt-20'>

      <Filter
        // filters data
        courses={courses}
        years={years}
        sections={sections}
        sortBy={sortBy}
        order={order}
        // set functions
        setCourses={setCourses}
        setYears={setYears}
        setSections={setSections}
        setSortBy={setSortBy}
        setOrder={setOrder}
        // submit
        applyFilters={applyFilters}
        // UI logic
        isOpen={isOpen}
        setIsOpen={() => {setIsOpen(!isOpen)}}
      />

      <StudentForm />

      {/* buttons */}
      <div className="fixed flex flex-row top-0 right-16 h-14 z-[1000] ">
        <button 
          onClick={() => {
            setIsSearchOpen(true)
            setSearchQuery("")
          }}
          className="grid place-items-center p-2 h-full bg-neutral-10 text-gray-700"
        >
          <IoSearch size={20} />
        </button>
        <button 
          onClick={() => {
            setIsOpen(true)
          }}
          className="grid place-items-center p-2 h-full bg-neutral-10 text-gray-700"
        >
          <RiFilter2Line size={20} />
        </button>
      </div>

      {isSearchOpen && (
        <SearchBar
          query={searchQuery}
          setQuery={(e) => setSearchQuery(e.target.value)}
          closeSearch={() => {
            setIsSearchOpen(false)
            setSearchQuery("")
            if (searchQuery !== "") {
              setStudents([])
              getStudents()
            }
          }}
        />
      )}

      
      <div className={` ${styles.studentsList} pb-40 px-5`}>
        {/* <SearchBar className='mb-6 pt-20' fill='bg-gray-200' />  */}
        {isStudentsEmpty ? (
          <div>
            <p className="text-sm font-semibold text-gray-400 text-center">No students found.</p>
          </div>
        ) : (
          <div className='shadow-sm h-fit'>
            {/* TODO: Implement infinite scrolling on students list */}
            <InfiniteScroll
              dataLength={students.length}
              next={() => {setPage(page + 1)}}
              hasMore={hasMore}
              endMessage={<div className="absolute w-full text-center left-0 mt-10 font-semibold text-sm text-gray-300" key={1}>Total students found: {students.length}</div>}
              loader={<div className="h-14 absolute left-0 w-full mt-5 items-center flex justify-center" key={0}>
                <l-line-spinner
                  size="25"
                  stroke="2"
                  speed="1" 
                  color="black"
                ></l-line-spinner>
              </div>}
            >
              {students.length !== 0 && students.map((student, index) => {
                return (
                  <StudentCard key={index} studentData={student} />
                )
              })}
            </InfiniteScroll>
          </div>
        )}
      </div>
    </div>
  )
}

export default Page