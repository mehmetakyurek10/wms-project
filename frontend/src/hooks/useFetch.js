import { useCallback, useEffect, useRef, useState } from "react";

function useFetch(fetcher, deps = [], options = {}) {
  const { initial = null, errorMessage = "Veriler yüklenemedi" } = options;

  const fetcherRef = useRef(fetcher);
  const requestIdRef = useRef(0);

  const [data, setData] = useState(initial);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");

  // Ref'e render sirasinda yazmak yanlis: iptal edilen bir render de
  // ref'i degistirmis olur. Effect'te yaziyoruz ve bu effect asagidaki
  // refresh effect'inden once tanimli oldugu icin ondan once calisiyor.
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setFetching(true);
    try {
      const response = await fetcherRef.current();
      if (requestId !== requestIdRef.current) return;
      setData(response.data);
      setTotal(parseInt(response.headers?.["x-toplam-kayit"], 10) || 0);
      setError("");
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err.response?.data?.hata || errorMessage);
    } finally {
      if (requestId === requestIdRef.current) {
        setFetching(false);
        setLoading(false);
      }
    }
    // Bagimlilik listesini cagiran taraf belirliyor; lint bunu statik
    // olarak dogrulayamadigi icin kural burada kapatiliyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  }, deps);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, total, loading, fetching, error, refresh, setData };
}

export default useFetch;
